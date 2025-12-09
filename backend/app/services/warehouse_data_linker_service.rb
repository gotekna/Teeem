# Service to link existing data into the warehouse structure
# Connects documents to their parent entities (Jobs, POs, Invoices)
class WarehouseDataLinkerService
  attr_reader :results

  def initialize
    @results = {
      invoices_linked: 0,
      pos_linked: 0,
      jobs_linked: 0,
      errors: []
    }
  end

  # Run all linking operations
  def link_all!
    Rails.logger.info("[WarehouseLinker] Starting data linking...")

    link_invoice_documents!
    link_po_documents!
    link_job_documents!

    # Refresh views after linking
    RefreshMaterializedViewsJob.new.perform

    Rails.logger.info("[WarehouseLinker] Complete: #{results.inspect}")
    results
  end

  # Link documents to ExternalInvoices based on matching criteria
  def link_invoice_documents!
    # Find documents that look like invoices but aren't linked
    invoice_docs = CorporateCompanyDocument
      .where(documentable_type: nil)
      .where("document_type ILIKE '%invoice%' OR document_type ILIKE '%bill%' OR title ILIKE '%INV-%' OR title ILIKE '%BILL-%'")

    invoice_docs.find_each do |doc|
      begin
        # Try to match by invoice number in title
        invoice = find_matching_invoice(doc)
        if invoice
          doc.update!(documentable: invoice)
          @results[:invoices_linked] += 1
          Rails.logger.info("[WarehouseLinker] Linked doc #{doc.id} to invoice #{invoice.id}")
        end
      rescue StandardError => e
        @results[:errors] << { doc_id: doc.id, error: e.message }
      end
    end
  end

  # Link documents to PurchaseOrders based on matching criteria
  def link_po_documents!
    # Find documents that look like POs but aren't linked
    po_docs = CorporateCompanyDocument
      .where(documentable_type: nil)
      .where("document_type ILIKE '%purchase%' OR document_type ILIKE '%po%' OR title ILIKE '%PO-%'")

    po_docs.find_each do |doc|
      begin
        po = find_matching_po(doc)
        if po
          doc.update!(documentable: po)
          @results[:pos_linked] += 1
          Rails.logger.info("[WarehouseLinker] Linked doc #{doc.id} to PO #{po.id}")
        end
      rescue StandardError => e
        @results[:errors] << { doc_id: doc.id, error: e.message }
      end
    end
  end

  # Link documents to Jobs based on job reference in title/folder
  def link_job_documents!
    # Find documents with job references that aren't linked
    # Skip documents already linked to something or that are company-level docs
    unlinked_docs = CorporateCompanyDocument
      .where(documentable_type: nil)
      .where.not(document_type: [ "invoice", "bill", "purchase_order" ]) # Skip invoice/PO types

    unlinked_docs.find_each do |doc|
      begin
        job = find_matching_job(doc)
        if job
          doc.update!(documentable: job)
          @results[:jobs_linked] += 1
          Rails.logger.info("[WarehouseLinker] Linked doc #{doc.id} to job #{job.id}")
        end
      rescue StandardError => e
        @results[:errors] << { doc_id: doc.id, error: e.message }
      end
    end
  end

  private

  def find_matching_invoice(doc)
    # Extract invoice number patterns from title
    # Common patterns: INV-001234, Invoice 001234, etc.
    title = doc.title.to_s

    # Try exact invoice number match
    if match = title.match(/INV[- ]?(\d+)/i)
      invoice_num = match[1]
      invoice = ExternalInvoice.find_by("invoice_number ILIKE ?", "%#{invoice_num}%")
      return invoice if invoice
    end

    # Try matching by external_id if document came from Xero
    if doc.source == "xero" && doc.external_id.present?
      # external_id might be formatted as "xero:invoice_guid:attachment_id"
      parts = doc.external_id.to_s.split(":")
      if parts.length >= 2
        invoice = ExternalInvoice.find_by(external_id: parts[1])
        return invoice if invoice
      end
    end

    nil
  end

  def find_matching_po(doc)
    title = doc.title.to_s

    # Try PO number match
    if match = title.match(/PO[- ]?(\d+)/i)
      po_num = "PO-#{match[1].rjust(6, '0')}"
      po = PurchaseOrder.find_by(purchase_order_number: po_num)
      return po if po
    end

    nil
  end

  def find_matching_job(doc)
    # Try to find job by folder path or title containing job reference
    # This is project-specific - adjust patterns as needed

    # If document has a folder that matches a job title pattern
    if doc.folder.present?
      # Try matching folder to job title
      job = Job.where("title ILIKE ?", "%#{doc.folder}%").first
      return job if job
    end

    nil
  end
end
