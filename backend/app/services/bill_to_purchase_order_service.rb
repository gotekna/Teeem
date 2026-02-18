class BillToPurchaseOrderService
  attr_reader :job

  def initialize(job)
    @job = job
  end

  def generate_all
    bills = unlinked_bills
    result = { created: [], skipped: [], errors: [] }

    bills.find_each do |bill|
      po = create_po_from_bill(bill)
      result[:created] << {
        po_id: po.id,
        po_number: po.purchase_order_number,
        bill_number: bill.invoice_number,
        supplier: bill.contact_name,
        total: bill.total
      }
    rescue StandardError => e
      result[:errors] << {
        bill_id: bill.id,
        bill_number: bill.invoice_number,
        error: e.message
      }
    end

    result
  end

  def self.summary
    # Find all jobs that have bills without POs
    jobs_with_bills = Job.joins(:external_invoices)
                         .merge(ExternalInvoice.bills.active)
                         .distinct

    summary = []
    jobs_with_bills.find_each do |job|
      service = new(job)
      unlinked = service.send(:unlinked_bills)
      count = unlinked.count
      next if count.zero?

      total_value = unlinked.sum(:total) || 0
      summary << {
        job_id: job.id,
        job_code: job.respond_to?(:job_code) ? job.job_code : job.id.to_s,
        unlinked_bills: count,
        total_value: total_value
      }
    end

    summary.sort_by { |s| -s[:unlinked_bills] }
  end

  private

  def unlinked_bills
    linked_xero_ids = PurchaseOrder.where(job: job)
                                   .where.not(xero_invoice_id: [nil, ""])
                                   .pluck(:xero_invoice_id)
    linked_ext_ids = PurchaseOrder.where(job: job)
                                  .where.not(external_invoice_id: nil)
                                  .pluck(:external_invoice_id)

    scope = job.external_invoices.bills.active
    scope = scope.where.not(external_id: linked_xero_ids) if linked_xero_ids.any?
    scope = scope.where.not(id: linked_ext_ids) if linked_ext_ids.any?
    scope
  end

  def create_po_from_bill(bill)
    po = PurchaseOrder.new(
      job: job,
      tenant_id: job.tenant_id,
      supplier_id: bill.contact_id,
      status: determine_status(bill),
      description: build_description(bill),
      xero_invoice_id: bill.external_id,
      external_invoice_id: bill.id,
      xero_invoice_number: bill.invoice_number,
      xero_supplier: bill.contact_name,
      invoice_date: bill.invoice_date,
      invoice_reference: bill.invoice_number,
      due_date: bill.due_date,
      payment_status: determine_payment_status(bill),
      xero_amount_paid: bill.amount_paid || 0,
      xero_paid_date: bill.fully_paid_date,
      invoiced_amount: bill.total || 0,
      sm_task_id: nil,
      creates_schedule_tasks: false
    )

    po.save!

    create_line_items(po, bill)

    po
  end

  def build_description(bill)
    parts = []
    parts << bill.reference if bill.reference.present?
    parts << "Bill #{bill.invoice_number}" if bill.invoice_number.present?
    parts << "from #{bill.contact_name}" if bill.contact_name.present?
    parts.join(" - ").presence || "Generated from Xero bill"
  end

  def determine_status(bill)
    case bill.status
    when "paid"
      "paid"
    when "voided", "deleted"
      "cancelled"
    else
      "invoiced"
    end
  end

  def determine_payment_status(bill)
    return "pending" if bill.amount_paid.nil? || bill.amount_paid.zero?
    return "complete" if bill.status == "paid"

    if bill.total.present? && bill.total.positive?
      ratio = bill.amount_paid / bill.total
      if ratio >= 0.95
        "complete"
      else
        "part_payment"
      end
    else
      "pending"
    end
  end

  def create_line_items(po, bill)
    items = bill.line_items
    return unless items.is_a?(Array) && items.any?

    items.each_with_index do |item, index|
      description = item["Description"].presence || item["ItemCode"].presence || "Line item #{index + 1}"
      quantity = (item["Quantity"] || 1).to_f
      unit_price = (item["UnitAmount"] || 0).to_f
      tax_amount = (item["TaxAmount"] || 0).to_f

      # SSoT: Use GstCode model for Xero TaxType mapping, fall back to heuristic
      gst_code = if item["TaxType"].present?
                   GstCode.for_xero_tax_type(item["TaxType"])
                 elsif tax_amount.zero? && unit_price.positive?
                   "GST Free"
                 else
                   "GST"
                 end

      PurchaseOrderLineItem.create!(
        purchase_order: po,
        description: description,
        quantity: quantity,
        unit_price: unit_price,
        line_number: index + 1,
        gst_code: gst_code,
        notes: item["AccountCode"].present? ? "Xero account: #{item["AccountCode"]}" : nil
      )
    end
  end
end
