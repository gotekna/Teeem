# Service to sync attachments from Xero invoices/bills to CorporateCompanyDocuments
# Links downloaded documents to ExternalInvoice via polymorphic documentable
# Also uploads PDFs to SharePoint folder structure: Contacts/{contact_folder}/BILLS|INVOICES/
class XeroAttachmentSyncService
  attr_reader :external_invoice, :xero_client, :results

  def initialize(external_invoice, skip_sharepoint: false)
    @external_invoice = external_invoice
    @xero_client = XeroApiClient.new
    @skip_sharepoint = skip_sharepoint
    @results = { pdf: nil, attachments: [], errors: [], sharepoint_uploads: [] }
  end

  # Sync all attachments for this invoice
  # @return [Hash] - { pdf: CorporateCompanyDocument, attachments: [CorporateCompanyDocument...], errors: [...] }
  def sync!
    return error_result("No external_id on invoice") unless external_invoice.external_id.present?
    return error_result("No tenant_id on invoice") unless external_invoice.tenant_id.present?

    Rails.logger.info("[XeroAttachmentSync] Starting sync for invoice #{external_invoice.id} (#{external_invoice.invoice_number})")

    # 1. Sync the invoice PDF (Xero-generated)
    sync_invoice_pdf

    # 2. Sync any additional attachments
    sync_attachments

    Rails.logger.info("[XeroAttachmentSync] Complete for invoice #{external_invoice.id}: PDF=#{results[:pdf].present?}, Attachments=#{results[:attachments].count}")

    results
  end

  private

  def error_result(message)
    @results[:errors] << message
    @results
  end

  def sync_invoice_pdf
    # Check if PDF already exists in SharePoint - skip API call if we have it
    external_doc_id = "xero:#{external_invoice.external_id}:pdf"
    existing_pdf = CorporateCompanyDocument.find_by(source: "xero", external_id: external_doc_id)

    if existing_pdf.present? && existing_pdf.sharepoint_file_id.present?
      Rails.logger.info("[XeroAttachmentSync] PDF already synced to SharePoint, skipping: #{existing_pdf.title}")
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

    # Create or update CorporateCompanyDocument
    filename = build_pdf_filename
    external_doc_id = "xero:#{external_invoice.external_id}:pdf"

    document = CorporateCompanyDocument.find_or_initialize_by(
      source: "xero",
      external_id: external_doc_id
    )

    # Attach the PDF content
    # Link to contact (for contact document tabs) AND to external_invoice (for warehouse queries)
    document.assign_attributes(
      title: filename,
      document_type: document_type_for_invoice,
      folder: folder_for_invoice_type,              # BILLS, INVOICES, etc. for contact tabs
      contact_id: external_invoice.contact_id,      # Link to contact for document management
      documentable: external_invoice,               # Also link to warehouse record
      job_id: external_invoice.job_id,
      expected_sharepoint_path: expected_document_path(filename), # Full SharePoint path
      file_size: pdf_result[:content_length] || pdf_result[:content].bytesize,
      file_name: filename,
      mime_type: "application/pdf",
      ai_verification_status: "verified" # Xero-sourced, no need for AI verification
    )

    # Attach the file via Active Storage
    document.file.attach(
      io: StringIO.new(pdf_result[:content]),
      filename: filename,
      content_type: "application/pdf"
    )

    if document.save
      results[:pdf] = document
      Rails.logger.info("[XeroAttachmentSync] Saved PDF: #{filename}")

      # Also upload to SharePoint
      upload_result = upload_to_sharepoint(pdf_result[:content], filename)

      # Update document with OneDrive file ID if upload succeeded
      if upload_result && upload_result[:id]
        document.update(sharepoint_file_id: upload_result[:id])
        Rails.logger.info("[XeroAttachmentSync] Updated document with OneDrive file ID: #{upload_result[:id]}")
      end
    else
      results[:errors] << "Failed to save PDF: #{document.errors.full_messages.join(', ')}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    # Race condition: another process created this PDF between our check and save
    # This is OK - just find the existing record and use it
    existing = CorporateCompanyDocument.find_by(source: "xero", external_id: external_doc_id)
    if existing
      results[:pdf] = existing
      results[:skipped] = true
      Rails.logger.info("[XeroAttachmentSync] PDF already exists (race condition avoided): #{filename}")
    else
      # Shouldn't happen, but log it
      results[:errors] << "Unique constraint violation but couldn't find existing record: #{e.message}"
      Rails.logger.error("[XeroAttachmentSync] Unique constraint violation: #{e.message}")
    end
  rescue XeroApiClient::RateLimitError => e
    # Re-raise rate limit errors so the caller can handle with backoff
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

    # Skip if already synced
    external_doc_id = "xero:#{external_invoice.external_id}:#{attachment_id}"
    existing = CorporateCompanyDocument.find_by(source: "xero", external_id: external_doc_id)

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

    # Create CorporateCompanyDocument
    # Link to contact (for contact document tabs) AND to external_invoice (for warehouse queries)
    document = CorporateCompanyDocument.new(
      source: "xero",
      external_id: external_doc_id,
      title: filename,
      document_type: guess_document_type(filename),
      folder: folder_for_invoice_type,              # BILLS, INVOICES, etc. for contact tabs
      contact_id: external_invoice.contact_id,      # Link to contact for document management
      documentable: external_invoice,               # Also link to warehouse record
      job_id: external_invoice.job_id,
      expected_sharepoint_path: expected_document_path(filename), # Full SharePoint path
      file_size: download_result[:content_length] || download_result[:content].bytesize,
      file_name: filename,
      mime_type: download_result[:mime_type] || attachment_info[:mime_type],
      ai_verification_status: "pending" # Attachments should go through AI verification
    )

    # Attach the file
    document.file.attach(
      io: StringIO.new(download_result[:content]),
      filename: filename,
      content_type: download_result[:mime_type] || "application/octet-stream"
    )

    if document.save
      results[:attachments] << document
      Rails.logger.info("[XeroAttachmentSync] Saved attachment: #{filename}")

      # Also upload to SharePoint
      upload_result = upload_to_sharepoint(download_result[:content], filename)

      # Update document with OneDrive file ID if upload succeeded
      if upload_result && upload_result[:id]
        document.update(sharepoint_file_id: upload_result[:id])
        Rails.logger.info("[XeroAttachmentSync] Updated document with OneDrive file ID: #{upload_result[:id]}")
      end
    else
      results[:errors] << "Failed to save #{filename}: #{document.errors.full_messages.join(', ')}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    # Race condition: another process created this attachment between our check and save
    existing = CorporateCompanyDocument.find_by(source: "xero", external_id: external_doc_id)
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
    # Map invoice types to valid CorporateCompanyDocument document_types
    # These must match DocumentType.pluck(:name) or LEGACY_DOCUMENT_TYPES
    case external_invoice.invoice_type
    when "sales_invoice" then "Sales Document"
    when "bill" then "Purchases"
    when "credit_note" then "other"
    when "quote" then "Estimation"
    else "other"
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
  # Uses CorporateCompanySetting.contact_documents_path + contact folder name + invoice type folder
  # e.g., "Contacts/123 - ABC Supplies/BILLS/BILL-001234.pdf"
  def expected_document_path(filename)
    settings = CorporateCompanySetting.instance
    base_path = settings.contact_documents_path || "Contacts"
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
    ext = File.extname(filename).downcase
    name = filename.downcase

    # Map attachment filenames to valid CorporateCompanyDocument document_types
    # Uses existing DocumentType names from the database
    return "Sales Document" if name.include?("invoice") || name.include?("inv")
    return "Purchases" if name.include?("bill")
    return "Expenses" if name.include?("receipt")
    return "contract" if name.include?("contract")
    return "Estimation" if name.include?("quote") || name.include?("estimate")

    # Default based on extension - use "General" which is a valid type
    case ext
    when ".pdf" then "General"
    when ".doc", ".docx" then "General"
    when ".xls", ".xlsx" then "General"
    when ".jpg", ".jpeg", ".png" then "General"
    else "other"
    end
  end

  # Upload file content to SharePoint using folder structure:
  # Contacts/{contact_folder}/BILLS|INVOICES/{filename}
  def upload_to_sharepoint(content, filename)
    return nil if @skip_sharepoint
    return nil unless external_invoice.contact.present?

    begin
      credential = OrganizationSharePointCredential.active_credential
      return nil unless credential.present?

      # MicrosoftGraphClient.new automatically refreshes expired tokens via ensure_valid_token!
      # If refresh fails (e.g., refresh token expired), it will raise AuthenticationError
      graph_client = MicrosoftGraphClient.new(credential)

      # Get or create Contacts folder at root
      settings = CorporateCompanySetting.instance
      base_folder_name = settings.contact_documents_path || "Contacts"

      # Find or create the base Contacts folder
      contacts_folder = graph_client.find_folder_in_drive_root(base_folder_name)
      unless contacts_folder
        contacts_folder = graph_client.create_folder(base_folder_name)
        Rails.logger.info("[XeroAttachmentSync] Created SharePoint folder: #{base_folder_name}")
      end

      # Get or create contact subfolder (e.g., "456 - ABC Supplies")
      contact_folder_name = contact_folder_name()
      return nil unless contact_folder_name.present?

      contact_folder = graph_client.get_or_create_subfolder(contacts_folder["id"] || contacts_folder[:id], contact_folder_name)
      Rails.logger.info("[XeroAttachmentSync] Using contact folder: #{contact_folder_name}")

      # Get or create type subfolder (BILLS, INVOICES, etc.)
      type_folder_name = folder_for_invoice_type
      type_folder = graph_client.get_or_create_subfolder(contact_folder[:id] || contact_folder["id"], type_folder_name)
      Rails.logger.info("[XeroAttachmentSync] Using type folder: #{type_folder_name}")

      # Upload the file
      upload_result = graph_client.upload_file_content(
        type_folder[:id] || type_folder["id"],
        filename,
        content
      )

      Rails.logger.info("[XeroAttachmentSync] Uploaded to SharePoint: #{filename} -> #{upload_result[:web_url]}")

      results[:sharepoint_uploads] << {
        filename: filename,
        folder: "#{base_folder_name}/#{contact_folder_name}/#{type_folder_name}",
        web_url: upload_result[:web_url]
      }

      upload_result
    rescue MicrosoftGraphClient::AuthenticationError => e
      error_msg = "OneDrive credential authentication failed - token refresh unsuccessful. Please reconnect OneDrive in Settings > Integrations."
      results[:errors] << error_msg
      Rails.logger.error("[XeroAttachmentSync] #{error_msg} Details: #{e.message}")
      nil
    rescue MicrosoftGraphClient::APIError => e
      results[:errors] << "SharePoint API error: #{e.message}"
      Rails.logger.error("[XeroAttachmentSync] SharePoint API error: #{e.message}")
      nil
    rescue StandardError => e
      results[:errors] << "SharePoint upload error: #{e.message}"
      Rails.logger.error("[XeroAttachmentSync] SharePoint upload error: #{e.message}")
      nil
    end
  end
end
