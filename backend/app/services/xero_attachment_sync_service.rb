# frozen_string_literal: true

# Service to sync attachments from Xero invoices/bills to WarehouseDocument
#
# SSoT Architecture (Feb 2026):
# ┌─────────────────────────────────────────────────────────────────┐
# │ WarehouseFolder (SSoT for folder structure)                          │
# │ ├── warehouse_type: "contact"                                   │
# │ ├── full_folder_path: "{{ContactName}}/Bills"                   │
# │     ↓ links via                                                 │
# │ WarehouseFolderDocumentType (join table, is_primary: true)           │
# │     ↓ to                                                        │
# │ DocumentType (classification)                                   │
# │ ├── name: "Xero Bill"                                           │
# │ ├── derived_scope: computed from WarehouseFolder.warehouse_type      │
# │     ↓ used by                                                   │
# │ WarehouseDocument (universal metadata)                          │
# │ ├── documentable: ExternalInvoice                               │
# │ ├── storage_blob_id: → StorageBlob                              │
# │ ├── folder: computed from WarehouseFolder template                   │
# │ ├── source_type: "xero"                                         │
# │     ↓ links to                                                  │
# │ StorageBlob (flat storage, deduplication)                       │
# │ ├── content_hash: SHA256                                        │
# │ ├── storage_path: "Blobs/ab/abc123.pdf"                         │
# └─────────────────────────────────────────────────────────────────┘
#
# Physical Storage: s3://bucket/Blobs/{hash_prefix}/{hash}.pdf
# Virtual Folders: Computed from WarehouseFolder.display_name, stored in warehouse_documents.folder
#
class XeroAttachmentSyncService
  include DocumentProviderAware
  attr_reader :external_invoice, :xero_client, :results

  def initialize(external_invoice, skip_storage_upload: false)
    @external_invoice = external_invoice
    @xero_client = XeroApiClient.new
    @skip_storage_upload = skip_storage_upload

    # FRC (Feb 2026): Fixed tenant_id confusion
    # ExternalInvoice.tenant_id is NOW the TEEEM Tenant.id (integer FK)
    # Xero org UUID is stored in raw_data or looked up via XeroCredential
    @tenant = Tenant.find_by(id: external_invoice.tenant_id)

    # Get Xero tenant UUID for API calls (from raw_data or credential lookup)
    @xero_tenant_id = find_xero_tenant_id_for_invoice
    @xero_credential = XeroCredential.find_by(tenant_id: @xero_tenant_id) if @xero_tenant_id
    @xero_tenant_name = @xero_credential&.tenant_name

    @organization = @tenant&.organizations&.where(is_active: true)&.first
    @storage_config = @tenant ? WarehouseProvider.for_tenant(@tenant) : nil
    @results = { pdf: nil, attachments: [], errors: [], skipped: false }
  end

  # FRC (Feb 2026): Get Xero tenant UUID for API calls
  # ExternalInvoice.tenant_id is TEEEM integer, need Xero UUID for API
  def find_xero_tenant_id_for_invoice
    # First try raw_data (if stored during sync)
    xero_tid = external_invoice.raw_data&.dig("TenantId")
    return xero_tid if xero_tid.present?

    # Fallback: Look up via XeroCredential.teeem_tenant_id
    credential = XeroCredential.find_by(teeem_tenant_id: external_invoice.tenant_id)
    credential&.tenant_id
  end

  # Sync all attachments for this invoice
  # @return [Hash] - { pdf: WarehouseDocument, attachments: [WarehouseDocument...], errors: [...] }
  def sync!
    return error_result("No external_id on invoice") unless external_invoice.external_id.present?
    return error_result("No tenant_id on invoice") unless external_invoice.tenant_id.present?
    return error_result("Tenant not found for tenant_id #{external_invoice.tenant_id}") unless @tenant
    return error_result("WarehouseProvider not found for tenant #{@tenant.name}") unless @storage_config

    # SSoT: Wrap entire sync in tenant context
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
    external_doc_id = "xero:#{external_invoice.external_id}:pdf"

    # Check if PDF already synced via WarehouseDocument
    existing = WarehouseDocument.find_by(
      documentable: external_invoice,
      source_type: "xero"
    )

    if existing.present? && existing.storage_blob_id.present?
      Rails.logger.info("[XeroAttachmentSync] PDF already synced via WarehouseDocument, skipping: #{existing.ui_name}")
      results[:pdf] = existing
      results[:skipped] = true
      return
    end

    # FRC (Feb 2026): Bills don't have Xero auto-generated PDFs
    # But they CAN have supplier-uploaded attachments. Create a "bill record"
    # WarehouseDocument without storage_blob so attachments can be synced.
    if external_invoice.bill?
      results[:pdf] = create_bill_record_document(existing)
      return
    end

    # Download PDF from Xero
    pdf_result = download_invoice_pdf
    unless pdf_result[:success]
      results[:errors] << "Failed to fetch PDF: #{pdf_result[:error]}"
      return
    end

    pdf_content = pdf_result[:content]
    filename = build_pdf_filename

    # SSoT: Get DocumentType from database (no hardcoding)
    document_type = find_document_type_for_invoice
    unless document_type
      results[:errors] << "DocumentType not found for invoice type: #{external_invoice.invoice_type}"
      return
    end

    # SSoT (Feb 2026): Get folder path from WarehouseFolder (no hardcoding)
    folder = compute_folder_from_document_type(document_type)

    # ========================================
    # SSoT Content-Hash Deduplication (Jan 2026)
    # ========================================
    # Before creating a new WarehouseDocument, check if a document with
    # the same content_hash already exists. If yes, link it to the Xero
    # invoice instead of creating a new one. This prevents duplicate
    # document metadata for the same file content.

    content_hash = StorageBlob.compute_hash(pdf_content)
    existing_by_content = find_document_by_content_hash(content_hash)

    if existing_by_content
      # Link existing document to Xero invoice
      linked_doc = link_existing_document_to_xero(existing_by_content, document_type, folder)
      if linked_doc
        results[:pdf] = linked_doc
        return
      end
      # If linking failed, fall through to create new document
    end

    # SSoT: Create StorageBlob (handles deduplication at storage level)
    storage_blob = StorageBlob.find_or_create_for_content!(
      pdf_content,
      filename: filename,
      content_type: "application/pdf"
    )
    storage_blob.increment_reference!

    # SSoT: Create WarehouseDocument (universal metadata)
    warehouse_doc = existing || WarehouseDocument.new
    warehouse_doc.assign_attributes(
      documentable: external_invoice,
      storage_blob: storage_blob,
      source_type: "xero",
      ui_name: build_display_name,  # SSoT: display_name renamed to ui_name (Feb 2026)
      original_filename: filename,
      tenant_id: @tenant.id,
      content_type: "application/pdf",
      file_size: pdf_content.bytesize,
      # Link to contact for filtering in File Warehouse
      linkable: external_invoice.contact,
      metadata: build_metadata(document_type)
    )

    if warehouse_doc.save
      results[:pdf] = warehouse_doc
      Rails.logger.info("[XeroAttachmentSync] Saved PDF via WarehouseDocument: #{filename} -> #{storage_blob.storage_path}")
    else
      storage_blob.decrement_reference!
      results[:errors] << "Failed to save WarehouseDocument: #{warehouse_doc.errors.full_messages.join(', ')}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    handle_race_condition(e, external_invoice, "pdf")
  rescue XeroApiClient::RateLimitError => e
    raise e
  rescue StandardError => e
    results[:errors] << "PDF sync error: #{e.message}"
    Rails.logger.error("[XeroAttachmentSync] PDF sync error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
  end

  # FRC (Feb 2026): Create a "bill record" WarehouseDocument for bills
  # Bills don't have Xero auto-generated PDFs, but can have supplier attachments.
  # This creates a primary document (without storage_blob) so attachments can link to it.
  def create_bill_record_document(existing)
    document_type = find_document_type_for_invoice
    folder = document_type ? compute_folder_from_document_type(document_type) : nil

    warehouse_doc = existing || WarehouseDocument.new
    warehouse_doc.assign_attributes(
      documentable: external_invoice,
      storage_blob: nil,  # No auto-generated PDF for bills
      source_type: "xero",
      ui_name: build_display_name,  # SSoT: display_name renamed to ui_name (Feb 2026)
      original_filename: nil,
      tenant_id: @tenant.id,
      content_type: nil,
      file_size: 0,
      linkable: external_invoice.contact,
      metadata: build_metadata(document_type).merge("is_bill_record" => true)
    )

    if warehouse_doc.save
      Rails.logger.info("[XeroAttachmentSync] Created bill record for attachments: #{external_invoice.invoice_number}")
      warehouse_doc
    else
      results[:errors] << "Failed to save bill record: #{warehouse_doc.errors.full_messages.join(', ')}"
      nil
    end
  rescue ActiveRecord::RecordNotUnique
    # Another job already created this - find and use it
    WarehouseDocument.find_by(documentable: external_invoice, source_type: "xero")
  end

  def sync_attachments
    entity_type = external_invoice.quote? ? "Quotes" : "Invoices"

    # FRC (Feb 2026): Use @xero_tenant_id (Xero UUID), NOT external_invoice.tenant_id (TEEEM integer)
    attachments_result = xero_client.get_attachments(
      entity_type,
      external_invoice.external_id,
      tenant_id: @xero_tenant_id
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

    # SSoT: Attachments link to the primary PDF document via parent_document_id
    # This avoids the unique constraint on documentable (one WarehouseDoc per source record)
    parent_doc = results[:pdf]
    unless parent_doc
      Rails.logger.warn("[XeroAttachmentSync] No parent PDF document for attachment: #{filename}")
      results[:errors] << "No parent PDF document for attachment: #{filename}"
      return
    end

    # Check if already synced (using parent_document_id + attachment_id in metadata)
    existing = WarehouseDocument.find_by(
      parent_document_id: parent_doc.id
    )&.then do |doc|
      doc if doc.metadata&.dig("attachment_id") == attachment_id
    end

    # Alternative check: search by metadata
    existing ||= WarehouseDocument.where(parent_document_id: parent_doc.id)
                                  .where("metadata->>'attachment_id' = ?", attachment_id)
                                  .first

    if existing.present? && existing.storage_blob_id.present?
      Rails.logger.debug("[XeroAttachmentSync] Skipping existing attachment: #{filename}")
      results[:attachments] << existing
      return
    end

    # Download the attachment
    # FRC (Feb 2026): Use @xero_tenant_id (Xero UUID), NOT external_invoice.tenant_id (TEEEM integer)
    download_result = xero_client.download_attachment(
      entity_type,
      external_invoice.external_id,
      filename,
      tenant_id: @xero_tenant_id
    )

    unless download_result[:success]
      results[:errors] << "Failed to download #{filename}: #{download_result[:error]}"
      return
    end

    content = download_result[:content]
    mime_type = download_result[:mime_type] || attachment_info[:mime_type] || "application/octet-stream"

    # SSoT: Get DocumentType for attachment (no hardcoding)
    document_type = find_document_type_for_attachment
    unless document_type
      results[:errors] << "DocumentType not found for attachment type: #{external_invoice.invoice_type}"
      return
    end

    folder = compute_folder_from_document_type(document_type)

    # SSoT: Create StorageBlob
    storage_blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: mime_type
    )
    storage_blob.increment_reference!

    # SSoT: Create WarehouseDocument as child of primary PDF
    # Attachments use parent_document_id to link to the primary PDF
    # documentable is nil for attachments (parent has the link to ExternalInvoice)
    warehouse_doc = WarehouseDocument.new(
      documentable: nil,  # Attachments don't link directly to ExternalInvoice
      parent_document_id: parent_doc.id,  # Link to primary PDF instead
      storage_blob: storage_blob,
      source_type: "xero",
      ui_name: filename,  # SSoT: display_name renamed to ui_name (Feb 2026)
      original_filename: filename,
      tenant_id: @tenant.id,
      content_type: mime_type,
      file_size: content.bytesize,
      linkable: external_invoice.contact,
      metadata: build_attachment_metadata(document_type, attachment_id, filename)
    )

    if warehouse_doc.save
      results[:attachments] << warehouse_doc
      Rails.logger.info("[XeroAttachmentSync] Saved attachment via WarehouseDocument (parent: #{parent_doc.id}): #{filename}")
    else
      storage_blob.decrement_reference!
      results[:errors] << "Failed to save attachment #{filename}: #{warehouse_doc.errors.full_messages.join(', ')}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    handle_attachment_race_condition(e, attachment_id, filename)
  rescue StandardError => e
    results[:errors] << "Attachment sync error (#{filename}): #{e.message}"
    Rails.logger.error("[XeroAttachmentSync] Attachment sync error: #{e.message}")
  end

  # ========================================
  # SSoT: DocumentType Lookup (No Hardcoding)
  # ========================================

  # Find DocumentType based on invoice type - reads from database
  def find_document_type_for_invoice
    type_name = case external_invoice.invoice_type
                when "bill" then "Xero Bill"
                when "credit_note" then "Xero Credit Note"
                else "Xero Invoice" # sales_invoice, quote
                end

    DocumentType.find_by(name: type_name)
  end

  # Find DocumentType for attachments - reads from database
  def find_document_type_for_attachment
    type_name = case external_invoice.invoice_type
                when "bill" then "Xero Bill Attachment"
                when "credit_note" then "Xero Credit Note Attachment"
                else "Xero Invoice Attachment"
                end

    # Fall back to generic attachment if specific doesn't exist
    DocumentType.find_by(name: type_name) ||
      DocumentType.find_by(name: "Xero Invoice Attachment")
  end

  # ========================================
  # SSoT (Feb 2026): Folder Computation from WarehouseFolder
  # ========================================

  # Compute folder path for Xero documents
  # Path structure: Contacts/{{ContactName}}/Financial/{{XeroOrgName}}/Bills
  # Falls back to: Contacts/{{ContactName}}/Financial/Bills (if no Xero org)
  def compute_folder_from_document_type(document_type)
    contact_name = contact_folder_name
    xero_org = @xero_tenant_name.presence
    doc_folder = document_type.folder.presence || document_type.primary_tab.presence || "Documents"

    parts = ["Contacts", contact_name, "Financial"]
    parts << xero_org if xero_org
    parts << doc_folder
    parts.compact.join("/")
  end

  # Expand folder template with invoice/contact context
  def expand_folder_template(template)
    contact = external_invoice.contact
    # Get company from tenant's billing_company (not contact)
    company = @tenant&.billing_company

    # Build substitution hash from actual data
    substitutions = {
      "ContactName" => contact_folder_name,
      "ContactId" => contact&.id,
      "CompanyGroup" => company&.company_group&.name.presence || "Default",
      "CompanyCode" => company&.company_code.presence || "Unknown",
      "CompanyName" => company&.name,
      "XeroConnectionName" => @xero_tenant_name,
      "Year" => (external_invoice.invoice_date || Date.current).year,
      "Month" => format("%02d", (external_invoice.invoice_date || Date.current).month)
    }

    result = template.dup
    substitutions.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s) if value.present?
    end

    # Remove unexpanded tokens
    result.gsub!(/\{\{[^}]+\}\}/, "")
    # Clean up double slashes
    result.gsub!(%r{//+}, "/")
    result.gsub!(%r{^/|/$}, "")

    result
  end

  # ========================================
  # Filename Building
  # ========================================

  def build_pdf_filename
    contact_id = external_invoice.contact_id
    matched_po = find_matching_purchase_order

    if matched_po
      po_num = matched_po.purchase_order_number
      contact_id.present? ? "#{contact_id}-#{po_num}.pdf" : "#{po_num}.pdf"
    else
      invoice_num = external_invoice.invoice_number.presence || external_invoice.external_id[0..7]
      contact_id.present? ? "#{contact_id}-#{invoice_num}.pdf" : "#{invoice_num}.pdf"
    end
  end

  def build_display_name
    invoice_num = external_invoice.invoice_number.presence || "Unknown"
    contact_name = external_invoice.contact&.name || "Unknown Contact"

    case external_invoice.invoice_type
    when "bill"
      "Bill #{invoice_num} - #{contact_name}"
    when "credit_note"
      "Credit Note #{invoice_num} - #{contact_name}"
    else
      "Invoice #{invoice_num} - #{contact_name}"
    end
  end

  def contact_folder_name
    contact = external_invoice.contact
    return nil unless contact.present?
    contact.document_folder_name
  end

  def find_matching_purchase_order
    return nil unless external_invoice.bill?
    return nil unless external_invoice.external_id.present?
    PurchaseOrder.find_by(xero_invoice_id: external_invoice.external_id)
  end

  # ========================================
  # Metadata Building
  # ========================================

  def build_metadata(document_type)
    {
      "invoice_number" => external_invoice.invoice_number,
      "invoice_type" => external_invoice.invoice_type,
      "xero_id" => external_invoice.external_id,
      "xero_tenant_id" => @xero_tenant_id,
      "xero_tenant_name" => @xero_tenant_name,
      "tenant_id" => @tenant&.id,
      "tenant_name" => @tenant&.name,
      "organization_id" => @organization&.id,
      "organization_name" => @organization&.name,
      "contact_id" => external_invoice.contact_id,
      "job_id" => external_invoice.job_id,
      "document_type_id" => document_type&.id,
      "document_type_name" => document_type&.name,
      "synced_at" => Time.current.iso8601,
      "is_primary" => true
    }
  end

  def build_attachment_metadata(document_type, attachment_id, filename)
    {
      "invoice_number" => external_invoice.invoice_number,
      "invoice_type" => external_invoice.invoice_type,
      "xero_id" => external_invoice.external_id,
      "xero_tenant_id" => @xero_tenant_id,
      "xero_tenant_name" => @xero_tenant_name,
      "tenant_id" => @tenant&.id,
      "tenant_name" => @tenant&.name,
      "organization_id" => @organization&.id,
      "organization_name" => @organization&.name,
      "attachment_id" => attachment_id,
      "original_filename" => filename,
      "contact_id" => external_invoice.contact_id,
      "job_id" => external_invoice.job_id,
      "document_type_id" => document_type&.id,
      "document_type_name" => document_type&.name,
      "synced_at" => Time.current.iso8601,
      "is_primary" => false
    }
  end

  # ========================================
  # Xero API Download
  # ========================================

  def download_invoice_pdf
    # FRC (Feb 2026): Use @xero_tenant_id (Xero UUID), NOT external_invoice.tenant_id (TEEEM integer)
    # The tenant_id on ExternalInvoice is the TEEEM Tenant.id FK, not the Xero org UUID.
    # This bug caused all API calls to fail or hit the wrong org's rate limits.
    case external_invoice.invoice_type
    when "quote"
      xero_client.get_quote_pdf(external_invoice.external_id, tenant_id: @xero_tenant_id)
    when "credit_note"
      xero_client.get_credit_note_pdf(external_invoice.external_id, tenant_id: @xero_tenant_id)
    else
      xero_client.get_invoice_pdf(external_invoice.external_id, tenant_id: @xero_tenant_id)
    end
  end

  # ========================================
  # SSoT Content-Hash Deduplication (Jan 2026)
  # ========================================

  # Find existing WarehouseDocument with same content hash
  # Returns nil if no match found or if already linked to this invoice
  def find_document_by_content_hash(hash)
    return nil if hash.blank?

    WarehouseDocument
      .joins(:storage_blob)
      .where(storage_blobs: { content_hash: hash })
      .where.not(documentable: external_invoice) # Not already linked to this invoice
      .where(tenant_id: @tenant.id)
      .first
  end

  # Link existing document to Xero invoice
  # Preserves original metadata while adding Xero link
  # @return [WarehouseDocument, nil] The updated document or nil if update failed
  def link_existing_document_to_xero(doc, document_type, folder)
    original_source_type = doc.source_type
    original_documentable_type = doc.documentable_type
    original_documentable_id = doc.documentable_id

    doc.assign_attributes(
      documentable: external_invoice,
      source_type: "xero",
      linkable: external_invoice.contact,
      metadata: (doc.metadata || {}).merge(
        "xero_id" => external_invoice.external_id,
        "xero_linked_at" => Time.current.iso8601,
        "original_source_type" => original_source_type,
        "original_documentable_type" => original_documentable_type,
        "original_documentable_id" => original_documentable_id,
        "document_type_id" => document_type&.id,
        "document_type_name" => document_type&.name,
        "invoice_number" => external_invoice.invoice_number,
        "invoice_type" => external_invoice.invoice_type
      )
    )

    if doc.save
      Rails.logger.info("[XeroAttachmentSync] Linked existing document #{doc.id} to ExternalInvoice #{external_invoice.id} (content-hash dedup)")
      doc
    else
      Rails.logger.warn("[XeroAttachmentSync] Failed to link existing document #{doc.id}: #{doc.errors.full_messages.join(', ')}")
      nil
    end
  end

  # ========================================
  # Race Condition Handling
  # ========================================

  def handle_race_condition(error, invoice, doc_type)
    existing = WarehouseDocument.find_by(
      documentable: invoice,
      source_type: "xero"
    )
    if existing
      results[:pdf] = existing
      results[:skipped] = true
      Rails.logger.info("[XeroAttachmentSync] PDF already exists (race condition avoided)")
    else
      results[:errors] << "Unique constraint violation: #{error.message}"
      Rails.logger.error("[XeroAttachmentSync] Unique constraint violation: #{error.message}")
    end
  end

  def handle_attachment_race_condition(error, attachment_id, filename)
    existing = WarehouseDocument.find_by(
      "metadata->>'attachment_id' = ? AND documentable_type = ? AND documentable_id = ?",
      attachment_id,
      "ExternalInvoice",
      external_invoice.id
    )
    if existing
      results[:attachments] << existing
      Rails.logger.info("[XeroAttachmentSync] Attachment already exists (race condition avoided): #{filename}")
    else
      results[:errors] << "Unique constraint violation: #{error.message}"
    end
  end
end
