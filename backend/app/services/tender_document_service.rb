# frozen_string_literal: true

# TenderDocumentService - Creates versioned tender documents from a job's POs.
#
# Flow:
#   1. Snapshot PO line items, grouped by tender section (from SM Schedule Master)
#   2. Snapshot job + client contact info (frozen at creation time)
#   3. Calculate section subtotals, GST, and grand total
#   4. Lock all PO budgets to prevent modification
#   5. Return the created TenderDocument
#
# Usage:
#   service = TenderDocumentService.new(job: job, user: current_user)
#   tender_doc = service.create!
#
class TenderDocumentService
  class CreationError < StandardError; end

  def initialize(job:, user:)
    @job = job
    @user = user
  end

  def create!
    TenderDocument.transaction do
      version = next_version_number

      doc = TenderDocument.create!(
        job: @job,
        created_by: @user,
        document_number: "TD-TEMP-#{SecureRandom.hex(4)}",
        version: version,
        date_prepared: Date.current,
        valid_until: Date.current + 30.days,
        validity_days: 30,
        previous_version_id: current_version&.id,
        status: "draft",
        **snapshot_job_data,
        **snapshot_client_data
      )

      snapshot_po_items!(doc)
      calculate_totals!(doc)
      doc.lock_pos!(@user)

      doc
    end
  rescue ActiveRecord::RecordInvalid => e
    raise CreationError, "Failed to create tender document: #{e.message}"
  end

  private

  def snapshot_po_items!(doc)
    line_counter_by_section = Hash.new(0)

    @job.purchase_orders.includes(:line_items, sm_task: :sm_schedule_master).find_each do |po|
      tender_section = resolve_tender_section(po)

      po.line_items.ordered.each do |item|
        section_name = tender_section&.name || "Unallocated"
        line_counter_by_section[section_name] += 1

        doc.tender_document_items.create!(
          tender_section_name: section_name,
          tender_section_code: tender_section&.code,
          section_sort_order: tender_section&.sort_order || 999,
          section_type: tender_section&.section_type || "priced",
          line_number: line_counter_by_section[section_name],
          description: item.description,
          quantity: item.quantity,
          unit: item.pricebook_item&.unit_of_measure,
          unit_price: item.unit_price,
          total_amount: item.total_amount,
          gst_code: item.gst_code || "GST",
          item_type: tender_section&.section_type || "priced",
          source_purchase_order_id: po.id,
          source_po_number: po.purchase_order_number,
          source_line_item_id: item.id,
          cost_centre_name: po.cost_centre_from_task,
          trade_name: po.trade_from_task
        )
      end
    end
  end

  def resolve_tender_section(po)
    tender_id = po.sm_task&.sm_schedule_master&.tender_id
    return nil unless tender_id

    Tender.find_by(id: tender_id)
  end

  def calculate_totals!(doc)
    priced_items = doc.tender_document_items.where(item_type: "priced")
    subtotal = priced_items.sum(:total_amount)

    # Calculate GST per item using GstCode rates
    gst_total = BigDecimal("0")
    priced_items.find_each do |item|
      rate = begin
        GstCode.rate_for(item.gst_code)
      rescue StandardError
        0.1 # Default to 10% GST if code not found
      end
      gst_total += (item.total_amount || 0) * rate
    end

    doc.update!(
      subtotal: subtotal,
      gst: gst_total.round(2),
      total: (subtotal + gst_total).round(2)
    )
  end

  def next_version_number
    (TenderDocument.where(job: @job).maximum(:version) || 0) + 1
  end

  def current_version
    TenderDocument.where(job: @job)
                  .where.not(status: "superseded")
                  .order(:version)
                  .last
  end

  def snapshot_job_data
    {
      job_name: @job.name,
      job_address: @job.try(:address) || @job.name,
      job_code: @job.job_code
    }
  end

  def snapshot_client_data
    client = @job.client
    return {} unless client

    salesperson = @job.job_contacts.find_by(role: "internal_sales")

    {
      client_name: client.display_name,
      client_address: client.full_address,
      client_email: client.primary_email,
      client_phone: client.primary_mobile,
      salesperson_name: salesperson&.person_name
    }
  end
end
