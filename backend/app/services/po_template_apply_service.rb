# frozen_string_literal: true

# Service to apply a PO Template Pack to a job.
#
# For each PoTemplateItem in the pack, creates a PurchaseOrder on the job:
# 1. Resolves supplier by supplier_id (same tenant) or supplier_sync_key (cross-tenant)
# 2. Finds matching SmTask on the job via sm_schedule_master_id
# 3. Creates PO with line items, using current pricebook prices when available
#
# Usage:
#   service = PoTemplateApplyService.new(pack, job)
#   result = service.execute   # Creates POs (all-or-nothing transaction)
#   result = service.preview   # Returns what WOULD happen without creating
#
class PoTemplateApplyService
  attr_reader :pack, :job, :warnings, :errors

  def initialize(pack, job)
    @pack = pack
    @job = job
    @warnings = []
    @errors = []
  end

  # Preview what would happen without creating anything
  def preview
    items = build_preview
    {
      pack_name: pack.name,
      job_name: job.name,
      items: items,
      warnings: warnings,
      total_pos: items.length,
      estimated_total: items.sum { |i| i[:estimated_total] || 0 },
      tasks_matched: items.count { |i| i[:task_matched] },
      tasks_unmatched: items.count { |i| !i[:task_matched] },
      suppliers_matched: items.count { |i| i[:supplier_matched] },
      suppliers_unmatched: items.count { |i| !i[:supplier_matched] }
    }
  end

  # Apply the template - creates all POs in a transaction
  def execute
    created_pos = []

    ActiveRecord::Base.transaction do
      pack.po_template_items.includes(:po_template_line_items, :sm_schedule_master, :supplier).each do |template_item|
        po = create_po_from_template(template_item)
        created_pos << po
      end
    end

    {
      success: true,
      created_count: created_pos.length,
      purchase_orders: created_pos.map { |po|
        {
          id: po.id,
          purchase_order_number: po.purchase_order_number,
          supplier_name: po.supplier&.display_name,
          task_name: po.sm_task&.name,
          total: po.total
        }
      },
      warnings: warnings
    }
  rescue ActiveRecord::RecordInvalid => e
    @errors << e.message
    { success: false, errors: errors, warnings: warnings }
  rescue StandardError => e
    @errors << "Unexpected error: #{e.message}"
    { success: false, errors: errors, warnings: warnings }
  end

  private

  def build_preview
    pack.po_template_items.includes(:po_template_line_items, :sm_schedule_master, :supplier).map do |template_item|
      supplier = resolve_supplier(template_item)
      task = find_matching_task(template_item)
      line_items = preview_line_items(template_item)

      {
        name: template_item.name,
        sm_schedule_master_name: template_item.sm_schedule_master&.name,
        supplier_name: supplier&.display_name || template_item.supplier_sync_key,
        supplier_matched: supplier.present?,
        task_name: task&.name,
        task_matched: task.present?,
        line_item_count: line_items.length,
        estimated_total: line_items.sum { |li| li[:subtotal] },
        line_items: line_items
      }
    end
  end

  def preview_line_items(template_item)
    template_item.po_template_line_items.map do |tli|
      price = resolve_price(tli)
      {
        description: tli.description,
        quantity: tli.quantity,
        unit_price: price,
        gst_code: tli.gst_code,
        subtotal: (tli.quantity || 0) * (price || 0),
        price_source: tli.pricebook_item_id ? "pricebook" : "template"
      }
    end
  end

  def create_po_from_template(template_item)
    supplier = resolve_supplier(template_item)
    task = find_matching_task(template_item)

    if task.nil? && template_item.sm_schedule_master_id.present?
      warnings << "No matching task found for '#{template_item.name}' (SM Master #{template_item.sm_schedule_master_id}) - PO created without task link"
    end

    if supplier.nil? && (template_item.supplier_id.present? || template_item.supplier_sync_key.present?)
      warnings << "Supplier not found for '#{template_item.name}' (#{template_item.supplier_sync_key || template_item.supplier_id}) - PO created without supplier"
    end

    po = PurchaseOrder.new(
      job: job,
      supplier: supplier,
      sm_task: task,
      status: template_item.status_on_create || "draft",
      budget: template_item.budget,
      description: template_item.notes
    )

    # Build line items
    template_item.po_template_line_items.each do |tli|
      price = resolve_price(tli)
      po.line_items.build(
        description: tli.description,
        quantity: tli.quantity,
        unit_price: price,
        gst_code: tli.gst_code || "GST",
        pricebook_item_id: tli.pricebook_item_id,
        line_number: tli.line_number
      )
    end

    po.save!
    po
  end

  # Resolve supplier: try supplier_id first, then cross-tenant match on supplier_sync_key
  def resolve_supplier(template_item)
    if template_item.supplier_id.present?
      Contact.find_by(id: template_item.supplier_id)
    elsif template_item.supplier_sync_key.present?
      Contact.find_by(display_name: template_item.supplier_sync_key)
    end
  end

  # Find the SmTask on this job that was created from the same SmScheduleMaster
  def find_matching_task(template_item)
    return nil unless template_item.sm_schedule_master_id.present?

    SmTask.find_by(
      job_id: job.id,
      sm_schedule_master_id: template_item.sm_schedule_master_id
    )
  end

  # Resolve price: use current pricebook price if available, fall back to template price
  def resolve_price(template_line_item)
    if template_line_item.pricebook_item_id.present?
      pricebook_item = PricebookItem.find_by(id: template_line_item.pricebook_item_id)
      if pricebook_item&.current_price.present? && pricebook_item.current_price > 0
        return pricebook_item.current_price
      end
    end

    template_line_item.unit_price || 0
  end
end
