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
    document.assign_attributes(
      title: filename,
      document_type: document_type_for_invoice,
      documentable: external_invoice,
      job_id: external_invoice.job_id,
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
    document = CompanyDocument.new(
      source: "xero",
      external_id: external_doc_id,
      title: filename,
      document_type: guess_document_type(filename),
      documentable: external_invoice,
      job_id: external_invoice.job_id,
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
    # Format: INV-001234.pdf or BILL-001234.pdf
    prefix = case external_invoice.invoice_type
    when "sales_invoice" then "INV"
    when "bill" then "BILL"
    when "credit_note" then "CN"
    when "quote" then "QUO"
    else "DOC"
    end

    invoice_num = external_invoice.invoice_number.presence || external_invoice.external_id[0..7]
    "#{prefix}-#{invoice_num}.pdf"
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
