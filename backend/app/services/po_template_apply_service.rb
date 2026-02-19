# frozen_string_literal: true

# Service to apply a PO Template Pack to a job.
#
# For each PoTemplateItem in the pack, creates a PurchaseOrder on the job:
# 1. Resolves supplier by supplier_id (same tenant) or supplier_sync_key (cross-tenant)
# 2. Finds matching SmTask on the job via sm_schedule_master_id, or creates one
# 3. Creates PO with line items, using current pricebook prices when available
#
# Usage:
#   service = PoTemplateApplyService.new(pack, job)
#   result = service.call   # Creates POs (all-or-nothing transaction)
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
      tasks_unmatched: items.count { |i| !i[:task_matched] && !i[:task_will_create] },
      tasks_will_create: items.count { |i| i[:task_will_create] },
      suppliers_matched: items.count { |i| i[:supplier_matched] },
      suppliers_unmatched: items.count { |i| !i[:supplier_matched] }
    }
  end

  # Apply the template - creates all POs in a transaction
  def call
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
    pack.po_template_items.includes(:po_template_line_items, :sm_schedule_master, :supplier, :profit_centre).map do |template_item|
      supplier = resolve_supplier(template_item)
      task = find_matching_task(template_item)
      line_items = preview_line_items(template_item)
      sm = template_item.sm_schedule_master
      will_create_task = task.nil? && sm.present?

      {
        name: template_item.name,
        sm_schedule_master_name: sm&.name,
        supplier_name: supplier&.display_name || template_item.supplier_sync_key,
        supplier_matched: supplier.present?,
        task_name: task&.name || sm&.name,
        task_matched: task.present?,
        task_will_create: will_create_task,
        line_item_count: line_items.length,
        estimated_total: line_items.sum { |li| li[:subtotal] },
        profit_centre_name: template_item.profit_centre&.code,
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
    task = find_or_create_task(template_item)

    if supplier.nil? && (template_item.supplier_id.present? || template_item.supplier_sync_key.present?)
      warnings << "Supplier not found for '#{template_item.name}' (#{template_item.supplier_sync_key || template_item.supplier_id}) - PO created without supplier"
    end

    po = PurchaseOrder.new(
      job: job,
      supplier: supplier,
      sm_task: task,
      status: template_item.status_on_create || "draft",
      budget: template_item.budget,
      description: template_item.name
    )

    # Build line items (profit_centre from template item applies to all lines)
    template_item.po_template_line_items.each do |tli|
      price = resolve_price(tli)
      po.line_items.build(
        description: tli.description,
        quantity: tli.quantity,
        unit_price: price,
        gst_code: tli.gst_code || "GST",
        pricebook_item_id: tli.pricebook_item_id,
        line_number: tli.line_number,
        profit_centre_id: template_item.profit_centre_id
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

  # Find an existing SmTask on this job, or create one from the SmScheduleMaster template
  def find_or_create_task(template_item)
    return nil unless template_item.sm_schedule_master_id.present?

    # Try to find existing task on this job
    existing = SmTask.find_by(
      job_id: job.id,
      sm_schedule_master_id: template_item.sm_schedule_master_id
    )
    return existing if existing

    # Create a new task from the schedule master template
    sm = template_item.sm_schedule_master
    return nil unless sm

    start_date = Date.current
    duration = sm.duration_days || 0
    next_seq = (SmTask.where(job_id: job.id).maximum(:sequence_order) || 0) + 1

    task = SmTask.new(
      job_id: job.id,
      sm_schedule_master_id: sm.id,
      task_number: sm.task_number || sm.id,
      sequence_order: next_seq,
      name: sm.name,
      description: sm.description,
      duration_days: duration,
      trade: sm.trade,
      stage: sm.stage,
      assigned_role: sm.assigned_role,
      checklist_id: sm.checklist_id,
      cost_centre: sm.cost_centre,
      status: "not_started",
      start_date: start_date,
      end_date: start_date + [duration, 1].max.days,
      po_required: sm.po_required.nil? ? true : sm.po_required,
      require_photo: sm.require_photo || false,
      has_subtasks: sm.has_subtasks || false,
      subtask_count: sm.subtask_count,
      subtask_names: sm.subtask_names,
      allow_header: sm.allow_header || false,
      header_gantt: sm.header_gantt,
      color: sm.color,
      spawn_order_task: sm.spawn_order_task || false,
      spawn_call_task: sm.spawn_call_task || false,
      order_time_days: sm.order_time_days,
      call_time_days: sm.call_time_days,
      tags: sm.tags,
      tenant_id: job&.tenant_id
    )
    task.save!
    warnings << "Created schedule task '#{sm.name}' on job (was missing)"
    task
  end

  # Find the SmTask on this job that was created from the same SmScheduleMaster (preview only)
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
