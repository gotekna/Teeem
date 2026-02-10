# frozen_string_literal: true

# DocumentInboxRoutingService - Routes classified documents to appropriate handlers
#
# SSoT: THE ONE service for document routing in DocSort
#
# Routing Map:
#   invoice → BillInbox (→ extraction → Xero)
#   plan → JobPlan (requires job linking)
#   quote → QuoteTracker (if enabled) or manual review
#   purchase_order → PurchaseOrder matching
#   contract → Review queue (manual)
#   certificate/compliance → Job compliance folder
#   correspondence → Job or general inbox
#   email → Email processing
#   general → Manual routing required
#
class DocumentInboxRoutingService
  def initialize(document_inbox)
    @item = document_inbox
  end

  # Route document based on classification
  # @return [Hash] { success: true/false, routed_to_type: "BillInbox", routed_to_id: 123 }
  def route!
    case @item.document_type
    when 'invoice'
      route_to_bill_inbox
    when 'plan'
      route_to_job_plan
    when 'quote'
      route_to_quote_tracker
    when 'purchase_order'
      route_to_purchase_order
    when 'contract'
      route_to_review_queue
    when 'certificate', 'compliance'
      route_to_compliance
    when 'correspondence'
      route_to_correspondence
    when 'email'
      route_email
    else
      # 'general' or unknown - requires manual routing
      {
        success: false,
        error: 'Manual routing required',
        needs_manual_review: true
      }
    end
  rescue StandardError => e
    Rails.logger.error "[DocumentInboxRoutingService] Routing failed for #{@item.id}: #{e.message}"
    {
      success: false,
      error: e.message
    }
  end

  private

  # Route invoice to BillInbox for extraction and processing
  def route_to_bill_inbox
    # Create BillInbox entry
    bill = BillInbox.create!(
      tenant: @item.tenant,
      source: 'docsort',
      status: 'pending',
      storage_blob: @item.storage_blob,
      original_filename: @item.original_filename,
      synced_email: @item.synced_email,
      metadata: {
        document_inbox_id: @item.id,
        classification_confidence: @item.classification_confidence
      }
    )

    # Queue extraction job
    InvoiceExtractionJob.perform_later(bill.id)

    {
      success: true,
      routed_to_type: 'BillInbox',
      routed_to_id: bill.id,
      message: 'Routed to Bill Inbox for extraction'
    }
  end

  # Route plan to JobPlan (requires job context)
  def route_to_job_plan
    # Try to detect job from email context or metadata
    job = detect_job_context

    if job.nil?
      return {
        success: false,
        error: 'Job context required for plans',
        needs_job_selection: true
      }
    end

    # Create JobPlan entry
    job_plan = JobPlan.create!(
      job: job,
      name: @item.original_filename || "Plan #{Time.current.strftime('%Y%m%d')}",
      description: "Imported from DocSort",
      status: 'pending',
      metadata: {
        document_inbox_id: @item.id,
        source: 'docsort'
      }
    )

    # Create revision with the file
    if @item.storage_blob.present?
      job_plan.revisions.create!(
        version: 1,
        storage_blob: @item.storage_blob,
        filename: @item.original_filename,
        uploaded_by: @item.uploaded_by
      )
    end

    # Transfer measurements and page scales from DocSort standalone takeoff (Feb 2026)
    transfer_takeoff_data_to_job_plan(job_plan)

    {
      success: true,
      routed_to_type: 'JobPlan',
      routed_to_id: job_plan.id,
      message: "Routed to Job #{job.job_code}",
      measurements_transferred: @item.takeoff_measurements.count,
      page_scales_transferred: @item.page_scales.count
    }
  end

  # Route quote to QuoteTracker
  def route_to_quote_tracker
    return quote_tracker_disabled_response unless quote_tracker_enabled?

    # Try to detect job context
    job = detect_job_context

    quote = QuoteTracker.create!(
      tenant: @item.tenant,
      job: job,
      status: 'received',
      source: 'docsort',
      storage_blob: @item.storage_blob,
      original_filename: @item.original_filename,
      from_email: @item.from_email,
      subject: @item.subject,
      metadata: {
        document_inbox_id: @item.id,
        classification_confidence: @item.classification_confidence
      }
    )

    # Queue AI extraction if enabled
    QuoteExtractionJob.perform_later(quote.id) if quote_extraction_enabled?

    {
      success: true,
      routed_to_type: 'QuoteTracker',
      routed_to_id: quote.id,
      message: 'Routed to Quote Tracker'
    }
  end

  # Route purchase order for matching
  def route_to_purchase_order
    # Try to match existing PO by number from filename
    po_number = extract_po_number(@item.original_filename)

    if po_number.present?
      existing_po = PurchaseOrder.find_by(po_number: po_number, tenant: @item.tenant)
      if existing_po
        # Attach document to existing PO
        attach_to_purchase_order(existing_po)
        return {
          success: true,
          routed_to_type: 'PurchaseOrder',
          routed_to_id: existing_po.id,
          message: "Attached to PO #{po_number}"
        }
      end
    end

    # No existing PO found - route to bill inbox as possible invoice
    route_to_bill_inbox
  end

  # Route contracts to review queue
  def route_to_review_queue
    # Contracts require manual review
    {
      success: false,
      error: 'Contracts require manual review',
      needs_manual_review: true,
      suggested_action: 'Review contract and assign to job'
    }
  end

  # Route certificates/compliance docs
  def route_to_compliance
    job = detect_job_context

    if job.nil?
      return {
        success: false,
        error: 'Job context required for compliance documents',
        needs_job_selection: true
      }
    end

    # Find or create compliance document type
    doc_type = find_compliance_document_type

    # Create WarehouseDocument in job's compliance folder
    warehouse_doc = create_warehouse_document_for_job(job, doc_type)

    {
      success: true,
      routed_to_type: 'WarehouseDocument',
      routed_to_id: warehouse_doc.id,
      message: "Filed in #{job.job_code}/Compliance"
    }
  end

  # Route correspondence
  def route_to_correspondence
    job = detect_job_context

    if job
      # File in job's correspondence folder
      doc_type = find_correspondence_document_type
      warehouse_doc = create_warehouse_document_for_job(job, doc_type)

      {
        success: true,
        routed_to_type: 'WarehouseDocument',
        routed_to_id: warehouse_doc.id,
        message: "Filed in #{job.job_code}/Correspondence"
      }
    else
      # General correspondence - file in corporate
      {
        success: false,
        error: 'No job context - requires manual filing',
        needs_manual_review: true
      }
    end
  end

  # Route email documents
  def route_email
    # If this came from a synced email, it's already in the system
    if @item.synced_email.present?
      return {
        success: true,
        routed_to_type: 'SyncedEmail',
        routed_to_id: @item.synced_email.id,
        message: 'Email already synced'
      }
    end

    # .eml/.msg file upload - create SyncedEmail
    # This is handled by email import service
    {
      success: false,
      error: 'Email file import not yet implemented',
      needs_manual_review: true
    }
  end

  # ========================================
  # Helper Methods
  # ========================================

  # Transfer takeoff measurements and page scales from DocSort to JobPlan (Feb 2026)
  # Called when routing a plan to a job - preserves any measurements taken before job assignment
  def transfer_takeoff_data_to_job_plan(job_plan)
    return if @item.nil?

    job = job_plan.job

    # Transfer page scales
    @item.page_scales.each do |scale|
      PageScale.create!(
        tenant: scale.tenant,
        job_plan: job_plan,
        page_number: scale.page_number,
        scale_factor: scale.scale_factor,
        reference_length_mm: scale.reference_length_mm,
        reference_length_px: scale.reference_length_px,
        scale_label: scale.scale_label,
        calibration_line: scale.calibration_line,
        ai_detected_scale: scale.ai_detected_scale,
        ai_confidence: scale.ai_confidence,
        calibrated_by: scale.calibrated_by,
        calibrated_at: scale.calibrated_at
      )
    end

    # Transfer measurements - update to link to job and job_plan instead of document_inbox
    @item.takeoff_measurements.each do |measurement|
      measurement.update!(
        job: job,
        job_plan: job_plan
        # Keep document_inbox_id for audit trail
      )
    end

    Rails.logger.info "[DocumentInboxRoutingService] Transferred #{@item.page_scales.count} page scales and #{@item.takeoff_measurements.count} measurements to JobPlan #{job_plan.id}"
  end

  # Try to detect job from various context clues
  def detect_job_context
    # 1. Check metadata for explicit job_id
    if @item.metadata['job_id'].present?
      job = Job.find_by(id: @item.metadata['job_id'], tenant: @item.tenant)
      return job if job
    end

    # 2. Check email subject for job references
    if @item.subject.present?
      # Look for job ID patterns: id:123, Job #123, [J-123], etc.
      job_id_match = @item.subject.match(/(?:id|job)[:.\-#\s]*(\d+)/i)
      if job_id_match
        job = Job.find_by(id: job_id_match[1], tenant: @item.tenant)
        return job if job
      end

      # Look for job code in subject
      Job.where(tenant: @item.tenant).find_each do |job|
        return job if @item.subject.downcase.include?(job.job_code.downcase)
      end
    end

    # 3. Check email thread inheritance
    if @item.synced_email&.job_id.present?
      return @item.synced_email.job
    end

    # 4. Check filename for job code
    if @item.original_filename.present?
      Job.where(tenant: @item.tenant).find_each do |job|
        return job if @item.original_filename.downcase.include?(job.job_code.downcase)
      end
    end

    nil
  end

  # Extract PO number from filename
  def extract_po_number(filename)
    return nil unless filename.present?

    # Match patterns: PO-12345, PO12345, PO_12345
    match = filename.match(/\bpo[-_.\s]?(\d+)/i)
    match ? match[1] : nil
  end

  # Attach document to existing PurchaseOrder
  def attach_to_purchase_order(po)
    return unless @item.storage_blob.present?

    WarehouseDocumentCreator.create!(
      filename: @item.original_filename || "PO #{po.po_number} Document",
      source_type: "job",
      documentable: po,
      storage_blob: @item.storage_blob,
      metadata: { "document_inbox_id" => @item.id }
    )

    @item.storage_blob.increment!(:reference_count)
  end

  # Create WarehouseDocument for job filing
  def create_warehouse_document_for_job(job, doc_type)
    warehouse_doc = WarehouseDocumentCreator.create!(
      filename: @item.original_filename || @item.display_name,
      source_type: "job",
      linkable: job,
      storage_blob: @item.storage_blob,
      file_size: @item.file_size,
      content_type: @item.content_type,
      metadata: {
        "document_inbox_id" => @item.id,
        "document_type" => doc_type&.name
      }
    )

    @item.storage_blob&.increment!(:reference_count)
    @item.update!(warehouse_document: warehouse_doc)

    warehouse_doc
  end

  # Find compliance document type
  def find_compliance_document_type
    DocumentType.find_by(
      name: 'Compliance',
      active: true
    ) || DocumentType.find_by(
      scope: 'compliance',
      active: true
    )
  end

  # Find correspondence document type
  def find_correspondence_document_type
    DocumentType.find_by(
      name: 'Correspondence',
      active: true
    ) || DocumentType.find_by(
      scope: 'job',
      active: true
    )
  end

  # Check if QuoteTracker feature is enabled
  def quote_tracker_enabled?
    defined?(QuoteTracker) && QuoteTracker.table_exists?
  end

  def quote_tracker_disabled_response
    {
      success: false,
      error: 'Quote Tracker not enabled',
      needs_manual_review: true
    }
  end

  # Check if quote extraction is enabled
  def quote_extraction_enabled?
    defined?(QuoteExtractionJob) &&
      (ENV['QUOTE_EXTRACTION_ENABLED'] == 'true' ||
       TenantSetting.quote_extraction_enabled? rescue false)
  end
end
