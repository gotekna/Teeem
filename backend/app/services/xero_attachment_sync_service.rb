# Service to sync attachments from Xero invoices/bills to document models
#
# SSoT: Uses StorageConfiguration.document_routing to determine which model to use:
# - xero_primary_invoice: ContactDocument (primary Xero invoice/bill PDFs go to contacts)
# - xero_attachment: CorporateCompanyDocument (supporting attachments go to corporate warehouse)
#
# Also uploads PDFs to storage folder structure: Contacts/{contact_folder}/BILLS|INVOICES/
# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
class XeroAttachmentSyncService
  include DocumentProviderAware
  attr_reader :external_invoice, :xero_client, :results

  def initialize(external_invoice, skip_sharepoint: false)
    @external_invoice = external_invoice
    @xero_client = XeroApiClient.new
    @skip_sharepoint = skip_sharepoint
    # SSoT: Derive TEEEM tenant from Xero tenant_id (Jan 2026 fix)
    # ExternalInvoice.tenant_id is Xero tenant UUID, not TEEEM Tenant.id
    # Flow: Xero tenant_id -> XeroCredential -> Organization -> Tenant
    @tenant = find_teeem_tenant_from_xero_tenant_id(external_invoice.tenant_id)
    @storage_config = @tenant ? StorageConfiguration.for_tenant(@tenant) : nil
    @results = { pdf: nil, attachments: [], errors: [], sharepoint_uploads: [] }
  end

  # Map Xero tenant_id (UUID) to TEEEM Tenant
  # @param xero_tenant_id [String] The Xero tenant UUID
  # @return [Tenant, nil] The matching TEEEM tenant
  def find_teeem_tenant_from_xero_tenant_id(xero_tenant_id)
    return nil unless xero_tenant_id.present?

    # Find XeroCredential with this Xero tenant ID
    xero_credential = XeroCredential.find_by(tenant_id: xero_tenant_id)
    return nil unless xero_credential

    # For now, get the first active organization's tenant
    # Future: Add xero_credential_id to Organization for direct link
    org = Organization.where(is_active: true).first
    org&.tenant
  end

  # Sync all attachments for this invoice
  # @return [Hash] - { pdf: CorporateCompanyDocument, attachments: [CorporateCompanyDocument...], errors: [...] }
  def sync!
    return error_result("No external_id on invoice") unless external_invoice.external_id.present?
    return error_result("No tenant_id on invoice") unless external_invoice.tenant_id.present?
    return error_result("Tenant not found for tenant_id #{external_invoice.tenant_id}") unless @tenant
    return error_result("StorageConfiguration not found for tenant #{@tenant.name}") unless @storage_config

    # SSoT: Wrap entire sync in tenant context (Jan 2026 fix)
    # Many models (Contact, ContactDocument) call StorageConfiguration.instance which requires tenant
    ActsAsTenant.with_tenant(@tenant) do
      Rails.logger.info("[XeroAttachmentSync] Starting sync for invoice #{external_invoice.id} (#{external_invoice.invoice_number})")

      # 1. Sync the invoice PDF (Xero-generated)
      sync_invoice_pdf

      # 2. Sync any additional attachments
      sync_attachments

      Rails.logger.info("[XeroAttachmentSync] Complete for invoice #{external_invoice.id}: PDF=#{results[:pdf].present?}, Attachments=#{results[:attachments].count}")
    end

    results
  end

  private

  def error_result(message)
    @results[:errors] << message
    @results
  end

  def sync_invoice_pdf
    # SSoT: Get the document model class from routing config
    document_model = @storage_config.document_model_for(:xero_primary_invoice)
    external_doc_id = "xero:#{external_invoice.external_id}:pdf"

    # Check if PDF already exists - skip API call if we have it
    existing_pdf = document_model.find_by(source: "xero", external_id: external_doc_id)

    if existing_pdf.present? && existing_pdf.respond_to?(:storage_reference) && existing_pdf.storage_reference.present?
      Rails.logger.info("[XeroAttachmentSync] PDF already synced to storage, skipping: #{existing_pdf.file_name}")
      results[:pdf] = existing_pdf
      results[:skipped] = true
      return
    end

    # Determine endpoint based on invoice type
    entity_type = case external_invoice.invoice_type
    when "quote" then "Quotes"
    when "credit_note" then "CreditNotes"
    else "Invoices"
    end

    pdf_result = case external_invoice.invoice_type
    when "quote"
                   xero_client.get_quote_pdf(external_invoice.external_id, tenant_id: external_invoice.tenant_id)
    when "credit_note"
                   xero_client.get_credit_note_pdf(external_invoice.external_id, tenant_id: external_invoice.tenant_id)
    else
                   xero_client.get_invoice_pdf(external_invoice.external_id, tenant_id: external_invoice.tenant_id)
    end

    unless pdf_result[:success]
      results[:errors] << "Failed to fetch PDF: #{pdf_result[:error]}"
      return
    end

    # Create or update document using SSoT model from routing
    filename = build_pdf_filename
    document = document_model.find_or_initialize_by(
      source: "xero",
      external_id: external_doc_id
    )

    # Build attributes based on which model we're using
    doc_attributes = build_document_attributes(
      document_model: document_model,
      filename: filename,
      document_type_name: document_type_for_invoice,
      folder: folder_for_invoice_type,
      file_size: pdf_result[:content_length] || pdf_result[:content].bytesize,
      mime_type: "application/pdf",
      is_primary: true  # Primary invoice PDF
    )

    document.assign_attributes(doc_attributes)

    # Attach the file via Active Storage
    document.file.attach(
      io: StringIO.new(pdf_result[:content]),
      filename: filename,
      content_type: "application/pdf"
    )

    if document.save
      results[:pdf] = document
      Rails.logger.info("[XeroAttachmentSync] Saved PDF (#{document_model.name}): #{filename}")

      # Also upload to storage
      upload_result = upload_to_storage(pdf_result[:content], filename)

      # Update document with storage file ID if upload succeeded
      if upload_result && upload_result[:id] && document.respond_to?(:sharepoint_file_id=)
        document.update(sharepoint_file_id: upload_result[:id])
        Rails.logger.info("[XeroAttachmentSync] Updated document with storage file ID: #{upload_result[:id]}")
      end
    else
      results[:errors] << "Failed to save PDF: #{document.errors.full_messages.join(', ')}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    # Race condition: another process created this PDF between our check and save
    existing = document_model.find_by(source: "xero", external_id: external_doc_id)
    if existing
      results[:pdf] = existing
      results[:skipped] = true
      Rails.logger.info("[XeroAttachmentSync] PDF already exists (race condition avoided): #{filename}")
    else
      results[:errors] << "Unique constraint violation but couldn't find existing record: #{e.message}"
      Rails.logger.error("[XeroAttachmentSync] Unique constraint violation: #{e.message}")
    end
  rescue XeroApiClient::RateLimitError => e
    raise e
  rescue StandardError => e
    results[:errors] << "PDF sync error: #{e.message}"
    Rails.logger.error("[XeroAttachmentSync] PDF sync error: #{e.message}")
  end

  def sync_attachments
    entity_type = external_invoice.quote? ? "Quotes" : "Invoices"

    attachments_result = xero_client.get_attachments(
      entity_type,
      external_invoice.external_id,
      tenant_id: external_invoice.tenant_id
    )

    unless attachments_result[:success]
      results[:errors] << "Failed to list attachments: #{attachments_result[:error]}"
      return
    end

    attachments = attachments_result[:attachments] || []
    Rails.logger.info("[XeroAttachmentSync] Found #{attachments.count} attachments")

    attachments.each do |att|
      sync_single_attachment(entity_type, att)
    end
  end

  def sync_single_attachment(entity_type, attachment_info)
    filename = attachment_info[:filename]
    attachment_id = attachment_info[:attachment_id]

    # SSoT: Get the document model class from routing config
    document_model = @storage_config.document_model_for(:xero_attachment)
    external_doc_id = "xero:#{external_invoice.external_id}:#{attachment_id}"

    # Skip if already synced
    existing = document_model.find_by(source: "xero", external_id: external_doc_id)

    if existing.present?
      Rails.logger.debug("[XeroAttachmentSync] Skipping existing attachment: #{filename}")
      results[:attachments] << existing
      return
    end

    # Download the attachment
    download_result = xero_client.download_attachment(
      entity_type,
      external_invoice.external_id,
      filename,
      tenant_id: external_invoice.tenant_id
    )

    unless download_result[:success]
      results[:errors] << "Failed to download #{filename}: #{download_result[:error]}"
      return
    end

    # Create document using SSoT model from routing
    doc_attributes = build_document_attributes(
      document_model: document_model,
      filename: filename,
      document_type_name: guess_document_type(filename),
      folder: folder_for_invoice_type,
      file_size: download_result[:content_length] || download_result[:content].bytesize,
      mime_type: download_result[:mime_type] || attachment_info[:mime_type],
      is_primary: false  # Attachment, not primary
    )

    document = document_model.new(
      source: "xero",
      external_id: external_doc_id,
      **doc_attributes
    )

    # Attach the file
    document.file.attach(
      io: StringIO.new(download_result[:content]),
      filename: filename,
      content_type: download_result[:mime_type] || "application/octet-stream"
    )

    if document.save
      results[:attachments] << document
      Rails.logger.info("[XeroAttachmentSync] Saved attachment (#{document_model.name}): #{filename}")

      # Also upload to storage
      upload_result = upload_to_storage(download_result[:content], filename)

      # Update document with storage file ID if upload succeeded
      if upload_result && upload_result[:id] && document.respond_to?(:sharepoint_file_id=)
        document.update(sharepoint_file_id: upload_result[:id])
        Rails.logger.info("[XeroAttachmentSync] Updated document with storage file ID: #{upload_result[:id]}")
      end
    else
      results[:errors] << "Failed to save #{filename}: #{document.errors.full_messages.join(', ')}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    # Race condition: another process created this attachment between our check and save
    existing = document_model.find_by(source: "xero", external_id: external_doc_id)
    if existing
      results[:attachments] << existing
      Rails.logger.info("[XeroAttachmentSync] Attachment already exists (race condition avoided): #{filename}")
    else
      results[:errors] << "Unique constraint violation but couldn't find existing record: #{e.message}"
      Rails.logger.error("[XeroAttachmentSync] Unique constraint violation: #{e.message}")
    end
  rescue StandardError => e
    results[:errors] << "Attachment sync error (#{filename}): #{e.message}"
    Rails.logger.error("[XeroAttachmentSync] Attachment sync error: #{e.message}")
  end

  def build_pdf_filename
    # If this bill matches a PO, use the PO number in the filename
    # This prevents duplicates and links bills to their POs visually
    # Format: 456-PO-000123.pdf (contact_id-po_number) for matched bills
    # Format: 456-INV-001234.pdf (contact_id-invoice_number) for unmatched
    contact_id = external_invoice.contact_id
    matched_po = find_matching_purchase_order

    if matched_po
      # Use PO number when matched
      po_num = matched_po.purchase_order_number # e.g., "PO-000123"
      if contact_id.present?
        "#{contact_id}-#{po_num}.pdf"
      else
        "#{po_num}.pdf"
      end
    else
      # Fall back to invoice number
      invoice_num = external_invoice.invoice_number.presence || external_invoice.external_id[0..7]
      if contact_id.present?
        "#{contact_id}-#{invoice_num}.pdf"
      else
        "#{invoice_num}.pdf"
      end
    end
  end

  # Find a PurchaseOrder that matches this external invoice
  # Matches by xero_invoice_id (Xero GUID stored on PO when matched)
  def find_matching_purchase_order
    return nil unless external_invoice.bill? # Only match bills to POs
    return nil unless external_invoice.external_id.present?

    PurchaseOrder.find_by(xero_invoice_id: external_invoice.external_id)
  end

  def document_type_for_invoice
    # SSoT: Map invoice types to Xero DocumentTypes created in AddXeroDocumentTypes migration
    # Primary invoices use ContactDocument with scope: contacts
    case external_invoice.invoice_type
    when "sales_invoice" then "Xero Invoice"
    when "bill" then "Xero Bill"
    when "credit_note" then "Xero Credit Note"
    when "quote" then "Xero Invoice"  # Quotes use invoice type
    else "Xero Invoice"
    end
  end

  # Folder name for contact document tabs
  # These appear in the contact's document management interface
  def folder_for_invoice_type
    case external_invoice.invoice_type
    when "bill" then "BILLS"
    when "sales_invoice" then "INVOICES"
    when "credit_note" then "CREDIT_NOTES"
    when "quote" then "QUOTES"
    else "XERO"
    end
  end

  # Generate the expected OneDrive path for this document
  # SSoT: Uses StorageConfiguration.path_for(:contacts) + contact folder name + invoice type folder
  # e.g., "Contacts/123 - ABC Supplies/BILLS/BILL-001234.pdf"
  def expected_document_path(filename)
    return nil unless @storage_config
    base_path = @storage_config.path_for(:contacts)
    contact_folder = contact_folder_name
    type_folder = folder_for_invoice_type

    [ base_path, contact_folder, type_folder, filename ].compact.join("/")
  end

  # Get the contact folder name using the configured format
  # Delegates to Contact.document_folder_name if contact is linked
  def contact_folder_name
    contact = external_invoice.contact
    return nil unless contact.present?

    contact.document_folder_name
  end

  def guess_document_type(filename)
    # SSoT: Attachments use specific types based on parent invoice type
    # Maps to CorporateCompanyDocument with scope: corporate_entity
    case external_invoice.invoice_type
    when "bill" then "Xero Bill Attachment"
    when "credit_note" then "Xero Credit Note Attachment"
    else "Xero Invoice Attachment"
    end
  end

  # SSoT: Build document attributes for the given model class
  # Handles differences between ContactDocument and CorporateCompanyDocument
  #
  # @param document_model [Class] The model class (ContactDocument or CorporateCompanyDocument)
  # @param filename [String] The filename
  # @param document_type_name [String] The document type name (for legacy document_type column)
  # @param folder [String] The folder name (BILLS, INVOICES, etc.)
  # @param file_size [Integer] File size in bytes
  # @param mime_type [String] MIME type of the file
  # @param is_primary [Boolean] Whether this is a primary document (determines AI verification)
  # @return [Hash] Attributes hash compatible with the given model
  def build_document_attributes(document_model:, filename:, document_type_name:, folder:, file_size:, mime_type:, is_primary: false)
    # Find the DocumentType record for linking
    document_type_record = DocumentType.find_by(name: document_type_name)

    # Common attributes for all document models
    attributes = {
      file_name: filename,
      folder: folder,
      file_size: file_size
    }

    # Model-specific attributes
    case document_model.name
    when "ContactDocument"
      # ContactDocument attributes
      attributes.merge!(
        contact_id: external_invoice.contact_id,
        document_type_id: document_type_record&.id,
        content_type: mime_type,
        storage_path: expected_document_path(filename)
      )

    when "CorporateCompanyDocument"
      # CorporateCompanyDocument attributes
      attributes.merge!(
        contact_id: external_invoice.contact_id,
        display_name: filename,
        document_type: document_type_name,    # Legacy string column
        document_type_id: document_type_record&.id,
        documentable: external_invoice,
        job_id: external_invoice.job_id,
        expected_storage_path: expected_document_path(filename),
        mime_type: mime_type,
        ai_verification_status: is_primary ? "verified" : "pending"
      )

    else
      # Fallback for unknown models - use common attributes
      Rails.logger.warn("[XeroAttachmentSync] Unknown document model: #{document_model.name}, using minimal attributes")
    end

    attributes
  end

  # Upload file content to storage using folder structure:
  # Contacts/{contact_folder}/BILLS|INVOICES/{filename}
  # SSoT: Uses DocumentProviderAware for provider-agnostic storage
  def upload_to_storage(content, filename)
    return nil if @skip_sharepoint
    return nil unless external_invoice.contact.present?

    begin
      # Tenant context is set by sync! wrapper - just set up provider
      setup_default_provider!

      # SSoT: Get contacts folder path from StorageConfiguration
      return nil unless @storage_config
      base_folder_name = @storage_config.path_for(:contacts)

      # Get contact folder name
      contact_name = contact_folder_name()
      return nil unless contact_name.present?

      # Get type subfolder (BILLS, INVOICES, etc.)
      type_folder_name = folder_for_invoice_type

      # Build full path
      full_path = "/#{base_folder_name}/#{contact_name}/#{type_folder_name}"

      # Ensure folder exists
      get_or_create_folder_path(full_path)

      # Upload the file
      upload_result = upload_to_provider(
        full_path,
        content,
        filename,
        content_type: "application/pdf"
      )

      Rails.logger.info("[XeroAttachmentSync] Uploaded to storage: #{filename} -> #{upload_result[:web_url] || upload_result[:path]}")

      results[:sharepoint_uploads] << {
        filename: filename,
        folder: full_path,
        web_url: upload_result[:web_url] || upload_result[:path]
      }

      upload_result
    rescue DocumentProviders::NotConnectedError => e
      error_msg = "Storage not connected. Please connect in Settings > Integrations."
      results[:errors] << error_msg
      Rails.logger.error("[XeroAttachmentSync] #{error_msg} Details: #{e.message}")
      nil
    rescue DocumentProviders::AuthenticationError => e
      error_msg = "Storage credential authentication failed - token refresh unsuccessful. Please reconnect in Settings > Integrations."
      results[:errors] << error_msg
      Rails.logger.error("[XeroAttachmentSync] #{error_msg} Details: #{e.message}")
      nil
    rescue DocumentProviders::Error => e
      results[:errors] << "Storage API error: #{e.message}"
      Rails.logger.error("[XeroAttachmentSync] Storage API error: #{e.message}")
      nil
    rescue StandardError => e
      results[:errors] << "Storage upload error: #{e.message}"
      Rails.logger.error("[XeroAttachmentSync] Storage upload error: #{e.message}")
      nil
    end
  end
end
