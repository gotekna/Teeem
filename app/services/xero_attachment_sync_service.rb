# Service to sync attachments from Xero invoices/bills to CompanyDocuments
# Links downloaded documents to ExternalInvoice via polymorphic documentable
class XeroAttachmentSyncService
  attr_reader :external_invoice, :xero_client, :results

  def initialize(external_invoice)
    @external_invoice = external_invoice
    @xero_client = XeroApiClient.new
    @results = { pdf: nil, attachments: [], errors: [] }
  end

  # Sync all attachments for this invoice
  # @return [Hash] - { pdf: CompanyDocument, attachments: [CompanyDocument...], errors: [...] }
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
    # Determine endpoint based on invoice type
    entity_type = external_invoice.quote? ? "Quotes" : "Invoices"

    pdf_result = if external_invoice.quote?
                   xero_client.get_quote_pdf(external_invoice.external_id, tenant_id: external_invoice.tenant_id)
    else
                   xero_client.get_invoice_pdf(external_invoice.external_id, tenant_id: external_invoice.tenant_id)
    end

    unless pdf_result[:success]
      results[:errors] << "Failed to fetch PDF: #{pdf_result[:error]}"
      return
    end

    # Create or update CompanyDocument
    filename = build_pdf_filename
    external_doc_id = "xero:#{external_invoice.external_id}:pdf"

    document = CompanyDocument.find_or_initialize_by(
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
      expected_onedrive_path: expected_document_path(filename), # Full OneDrive path
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
    else
      results[:errors] << "Failed to save PDF: #{document.errors.full_messages.join(', ')}"
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
    existing = CompanyDocument.find_by(source: "xero", external_id: external_doc_id)

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

    # Create CompanyDocument
    # Link to contact (for contact document tabs) AND to external_invoice (for warehouse queries)
    document = CompanyDocument.new(
      source: "xero",
      external_id: external_doc_id,
      title: filename,
      document_type: guess_document_type(filename),
      folder: folder_for_invoice_type,              # BILLS, INVOICES, etc. for contact tabs
      contact_id: external_invoice.contact_id,      # Link to contact for document management
      documentable: external_invoice,               # Also link to warehouse record
      job_id: external_invoice.job_id,
      expected_onedrive_path: expected_document_path(filename), # Full OneDrive path
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
    else
      results[:errors] << "Failed to save #{filename}: #{document.errors.full_messages.join(', ')}"
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
    case external_invoice.invoice_type
    when "sales_invoice" then "invoice"
    when "bill" then "bill"
    when "credit_note" then "credit_note"
    when "quote" then "quote"
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
  # Uses CompanySetting.contact_documents_path + contact folder name + invoice type folder
  # e.g., "Contacts/123 - ABC Supplies/BILLS/BILL-001234.pdf"
  def expected_document_path(filename)
    settings = CompanySetting.instance
    base_path = settings.contact_documents_path || "Contacts"
    contact_folder = contact_folder_name
    type_folder = folder_for_invoice_type

    [base_path, contact_folder, type_folder, filename].compact.join("/")
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

    # Common patterns
    return "invoice" if name.include?("invoice") || name.include?("inv")
    return "bill" if name.include?("bill")
    return "receipt" if name.include?("receipt")
    return "contract" if name.include?("contract")
    return "quote" if name.include?("quote") || name.include?("estimate")

    # Default based on extension
    case ext
    when ".pdf" then "document"
    when ".doc", ".docx" then "document"
    when ".xls", ".xlsx" then "spreadsheet"
    when ".jpg", ".jpeg", ".png" then "image"
    else "other"
    end
  end
end
