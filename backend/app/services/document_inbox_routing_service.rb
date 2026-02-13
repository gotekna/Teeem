# frozen_string_literal: true

# DocumentInboxRoutingService - Routes classified documents to appropriate handlers
#
# SSoT: THE ONE service for document routing in DocSort
#
# Routing Strategy:
#   ALL document types use the same generic path: route_via_document_type
#   The DocumentType SSoT determines: folder, scope (company/job/contacts), naming.
#   The DocumentType's primary_warehouse_folder drives where the document lands.
#
#   After filing, post-filing workflows are triggered for specific types:
#     invoice → BillInbox + extraction job
#     quote → QuoteTracker + extraction job
#     purchase_order → PO matching via metadata
#     plan (with takeoff data) → measurement transfer to job
#
class DocumentInboxRoutingService
  def initialize(document_inbox)
    @item = document_inbox
  end

  # Route document based on classification
  # ALL document types go through the same generic path driven by DocumentType SSoT.
  # Additional workflows (invoice extraction, PO matching) are triggered AFTER filing.
  # @return [Hash] { success: true/false, routed_to_type: "WarehouseDocument", routed_to_id: 123 }
  def route!
    route_via_document_type
  rescue StandardError => e
    Rails.logger.error "[DocumentInboxRoutingService] Routing failed for #{@item.id}: #{e.message}\n#{e.backtrace&.first(5)&.join("\n")}"
    {
      success: false,
      error: e.message
    }
  end

  private

  # ========================================
  # Generic DocumentType-driven routing
  # ========================================

  # Route using the DocumentType SSoT to determine folder, scope, and linkable.
  # This handles ALL document types that don't need a special model (BillInbox, JobPlan, etc.)
  def route_via_document_type
    doc_type = DocumentType.find_by_name_or_alias(@item.document_type) if @item.document_type.present?

    # Determine linkable (company, job, or contact) from scope + user-provided context
    linkable = resolve_linkable(doc_type)

    unless linkable
      scope = doc_type&.derived_scope || 'company'
      return {
        success: false,
        error: scope == 'job' ?
          'Job selection required - select a job to file under' :
          'Company selection required - select a company to file under',
        needs_manual_review: true,
        needs_job_selection: scope == 'job',
        needs_corporate_selection: scope != 'job'
      }
    end

    # Get the primary warehouse folder from the DocumentType (SSoT for folder config)
    primary_folder = doc_type&.primary_warehouse_folder

    # Determine source_type from the DocumentType scope
    source_type = case doc_type&.derived_scope
                  when 'company' then 'corporate'
                  when 'job' then 'job'
                  when 'contacts' then 'contact'
                  else 'corporate'
                  end

    # Create WarehouseDocument using DocumentType's folder config
    # WarehouseDocumentCreator + model callbacks handle: folder_path, download_name, tenant_id
    warehouse_doc = WarehouseDocumentCreator.create!(
      filename: @item.original_filename || @item.display_name,
      source_type: source_type,
      linkable: linkable,
      storage_blob: @item.storage_blob,
      warehouse_folder_id: primary_folder&.id,
      file_size: @item.file_size,
      content_type: @item.content_type,
      metadata: routing_metadata(doc_type, linkable)
    )

    @item.storage_blob&.increment!(:reference_count)
    @item.update!(warehouse_document: warehouse_doc)

    # Post-filing workflow triggers (filing is done, now kick off any additional processing)
    trigger_post_filing_workflows(warehouse_doc, doc_type, linkable)

    linkable_name = linkable.respond_to?(:name) ? linkable.name : linkable.class.name
    {
      success: true,
      routed_to_type: 'WarehouseDocument',
      routed_to_id: warehouse_doc.id,
      message: "Filed as #{doc_type&.name || @item.document_type} under #{linkable_name}"
    }
  end

  # Resolve the linkable record (Corporate, Job, or Contact) based on:
  # 1. DocumentType scope (company/job/contacts)
  # 2. User-provided metadata (corporate_id, job_id, contact_id)
  # 3. Auto-detection from email/filename context
  def resolve_linkable(doc_type)
    scope = doc_type&.derived_scope

    case scope
    when 'job'
      # Job-scoped: check explicit job_id first, then auto-detect
      if @item.metadata['job_id'].present?
        Job.find_by(id: @item.metadata['job_id'], tenant: @item.tenant)
      else
        detect_job_context
      end
    when 'contacts'
      # Contact-scoped: check explicit contact_id
      if @item.metadata['contact_id'].present?
        Contact.find_by(id: @item.metadata['contact_id'])
      end
    else
      # Company-scoped (default): check explicit corporate_id
      if @item.metadata['corporate_id'].present?
        Corporate.find_by(id: @item.metadata['corporate_id'])
      end
    end
  end

  # ========================================
  # Post-filing workflow triggers
  # ========================================

  # After filing a document, trigger any additional workflows based on document type.
  # Filing (WarehouseDocument creation) is SEPARATE from workflow triggers.
  def trigger_post_filing_workflows(warehouse_doc, doc_type, linkable)
    case @item.document_type
    when 'invoice'
      trigger_invoice_extraction(warehouse_doc)
    when 'purchase_order'
      trigger_po_matching(warehouse_doc)
    when 'quote'
      trigger_quote_extraction(warehouse_doc, linkable)
    end

    # Transfer takeoff measurements to job if present
    if linkable.is_a?(Job) && @item.takeoff_measurements.any?
      transfer_takeoff_data_to_job(linkable)
    end
  rescue StandardError => e
    # Workflow failures should not break the filing - document is already saved
    Rails.logger.error "[DocumentInboxRoutingService] Post-filing workflow failed: #{e.message}"
  end

  def trigger_invoice_extraction(warehouse_doc)
    return unless defined?(BillInbox)

    bill = BillInbox.create!(
      tenant: @item.tenant,
      source: 'docsort',
      status: 'pending',
      storage_blob: @item.storage_blob,
      original_filename: @item.original_filename,
      synced_email: @item.synced_email,
      metadata: {
        document_inbox_id: @item.id,
        warehouse_document_id: warehouse_doc.id,
        classification_confidence: @item.classification_confidence
      }
    )
    InvoiceExtractionJob.perform_later(bill.id) if defined?(InvoiceExtractionJob)
  end

  def trigger_po_matching(warehouse_doc)
    po_number = extract_po_number(@item.original_filename)
    return unless po_number.present?

    existing_po = PurchaseOrder.find_by(po_number: po_number, tenant: @item.tenant)
    return unless existing_po

    # Link the warehouse document to the PO
    warehouse_doc.update!(metadata: (warehouse_doc.metadata || {}).merge(
      "purchase_order_id" => existing_po.id,
      "po_number" => po_number
    ))
  end

  def trigger_quote_extraction(warehouse_doc, linkable)
    return unless defined?(QuoteTracker) && QuoteTracker.table_exists?

    quote = QuoteTracker.create!(
      tenant: @item.tenant,
      job: linkable.is_a?(Job) ? linkable : nil,
      status: 'received',
      source: 'docsort',
      storage_blob: @item.storage_blob,
      original_filename: @item.original_filename,
      from_email: @item.from_email,
      subject: @item.subject,
      metadata: {
        document_inbox_id: @item.id,
        warehouse_document_id: warehouse_doc.id,
        classification_confidence: @item.classification_confidence
      }
    )
    QuoteExtractionJob.perform_later(quote.id) if defined?(QuoteExtractionJob) && quote_extraction_enabled?
  end

  # ========================================
  # Metadata
  # ========================================

  # Build metadata hash for the WarehouseDocument.
  # Includes linkable context so the frontend can display company/job info without extra lookups.
  def routing_metadata(doc_type, linkable)
    meta = {
      "document_inbox_id" => @item.id,
      "document_type" => doc_type&.name || @item.document_type,
      "document_type_id" => doc_type&.id,
      "classification_confidence" => @item.classification_confidence,
      "synced_at" => Time.current.iso8601
    }

    case linkable
    when Corporate
      meta["company_id"] = linkable.id
    when Job
      meta["job_id"] = linkable.id
      meta["job_code"] = linkable.job_code
    when Contact
      meta["contact_id"] = linkable.id
    end

    meta
  end

  # ========================================
  # Helper Methods
  # ========================================

  # Transfer takeoff measurements from DocSort to a Job (Feb 2026)
  def transfer_takeoff_data_to_job(job)
    return if @item.nil?

    @item.takeoff_measurements.each do |measurement|
      measurement.update!(job: job)
    end

    Rails.logger.info "[DocumentInboxRoutingService] Transferred #{@item.takeoff_measurements.count} measurements to Job #{job.id}"
  end

  # Try to detect job from various context clues
  def detect_job_context
    if @item.metadata['job_id'].present?
      job = Job.find_by(id: @item.metadata['job_id'], tenant: @item.tenant)
      return job if job
    end

    if @item.subject.present?
      job_id_match = @item.subject.match(/(?:id|job)[:.\-#\s]*(\d+)/i)
      if job_id_match
        job = Job.find_by(id: job_id_match[1], tenant: @item.tenant)
        return job if job
      end

      Job.where(tenant: @item.tenant).find_each do |job|
        return job if @item.subject.downcase.include?(job.job_code.downcase)
      end
    end

    if @item.synced_email&.job_id.present?
      return @item.synced_email.job
    end

    if @item.original_filename.present?
      Job.where(tenant: @item.tenant).find_each do |job|
        return job if @item.original_filename.downcase.include?(job.job_code.downcase)
      end
    end

    nil
  end

  def extract_po_number(filename)
    return nil unless filename.present?
    match = filename.match(/\bpo[-_.\s]?(\d+)/i)
    match ? match[1] : nil
  end

  def quote_extraction_enabled?
    defined?(QuoteExtractionJob) &&
      (ENV['QUOTE_EXTRACTION_ENABLED'] == 'true' ||
       TenantSetting.quote_extraction_enabled? rescue false)
  end
end
