# frozen_string_literal: true

# Service to apply a PO Template Pack to a job.
#
# For each PoTemplateItem in the pack, creates a PurchaseOrder on the job:
# 1. Resolves supplier by supplier_id (same tenant) or supplier_sync_key (cross-tenant)
# 2. Finds matching SmTask on the job via sm_schedule_master_id, or creates one
# 3. Creates PO with line items, using current pricebook prices when available
#
# Schedule handling (when pack has a linked SmScheduleMasterTemplate):
# - No tasks on job → auto-copy schedule, then create POs
# - Same template on job → silent, just create POs linked to existing tasks
# - Different schedule on job → caller must pass schedule_action:
#   "copy_new"     → copy the pack's schedule, then create POs
#   "use_existing" → skip schedule copy, link POs to whatever tasks exist
#
# Usage:
#   service = PoTemplateApplyService.new(pack, job, schedule_action: "use_existing")
#   result = service.call   # Creates POs (all-or-nothing transaction)
#   result = service.preview   # Returns what WOULD happen without creating
#
class PoTemplateApplyService
  attr_reader :pack, :job, :warnings, :errors, :options

  def initialize(pack, job, options = {})
    @pack = pack
    @job = job
    @options = options.with_indifferent_access
    @warnings = []
    @errors = []
  end

  # Preview what would happen without creating anything
  def preview
    items = build_preview
    result = {
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

    # Add schedule template info if pack has a linked template
    if (template = pack.sm_schedule_master_template)
      result[:schedule_template] = build_schedule_info(template)
    end

    result
  end

  # Apply the template - creates all POs in a transaction
  def call
    created_pos = []
    schedule_result = nil

    ActiveRecord::Base.transaction do
      # Phase 1: Handle schedule copy based on situation
      if (template = pack.sm_schedule_master_template)
        schedule_result = handle_schedule_copy(template)
      end

      # Phase 2: Create POs (find_or_create_task will FIND existing tasks)
      pack.po_template_items.includes(:po_template_line_items, :sm_schedule_master, :supplier).each do |template_item|
        po = create_po_from_template(template_item)
        created_pos << po
      end
    end

    {
      success: true,
      created_count: created_pos.length,
      schedule_copied: schedule_result.present? && schedule_result[:success],
      schedule_tasks_created: schedule_result&.dig(:tasks_created) || 0,
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

  # Determine schedule info for the preview response
  def build_schedule_info(template)
    job_task_count = job.sm_tasks.count
    same = job_has_tasks_from_template?(template)

    info = {
      id: template.id,
      name: template.name,
      row_count: template.row_count,
      job_has_schedule: job_task_count > 0,
      same_template: same,
      existing_task_count: job_task_count,
      # action_required = job has tasks from a DIFFERENT template
      action_required: job_task_count > 0 && !same
    }

    # Try to identify which template the existing tasks came from
    if info[:action_required]
      info[:existing_template_name] = detect_existing_template_name
    end

    info
  end

  # Decide whether/how to copy the schedule during apply
  def handle_schedule_copy(template)
    job_task_count = job.sm_tasks.count
    same = job_has_tasks_from_template?(template)
    schedule_action = options[:schedule_action]

    if same
      # Same template already on job → nothing to do, POs will find existing tasks
      nil
    elsif job_task_count == 0
      # No schedule on job → auto-copy
      copy_schedule(template)
    elsif schedule_action == "copy_new"
      # Different schedule exists, user chose to copy the new one
      copy_schedule(template)
    elsif schedule_action == "use_existing"
      # Different schedule exists, user chose to keep it
      warnings << "Using existing schedule tasks (#{job_task_count} tasks) - POs will link to matching tasks"
      nil
    else
      # Different schedule exists but no action specified - this shouldn't happen
      # if frontend is implemented correctly, but default to use_existing as safe option
      warnings << "Job has existing schedule (#{job_task_count} tasks) - using existing tasks"
      nil
    end
  end

  def copy_schedule(template)
    result = template.copy_to_construction(job, create_purchase_orders: false)
    unless result[:success]
      raise StandardError, "Schedule copy failed: #{result[:errors]&.join(', ')}"
    end
    warnings << "Copied schedule '#{template.name}' (#{result[:tasks_created]} tasks with dependencies)"
    result
  end

  # Detect which template name the job's existing tasks came from
  def detect_existing_template_name
    existing_sm_ids = job.sm_tasks.where.not(sm_schedule_master_id: nil)
                         .pluck(:sm_schedule_master_id).uniq
    return nil if existing_sm_ids.empty?

    # SmScheduleMaster rows store which templates they belong to in sm_template_ids JSONB
    sm_rows = SmScheduleMaster.where(id: existing_sm_ids)
    template_id_counts = Hash.new(0)
    sm_rows.each do |row|
      (row.sm_template_ids || []).each { |tid| template_id_counts[tid] += 1 }
    end

    return nil if template_id_counts.empty?

    best_template_id = template_id_counts.max_by { |_, count| count }&.first
    SmScheduleMasterTemplate.find_by(id: best_template_id)&.name
  end

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
      pb_item_id = resolve_pricebook_item_id(tli)
      price = resolve_price(tli, pb_item_id)
      {
        description: tli.description,
        quantity: tli.quantity,
        unit_price: price,
        gst_code: tli.gst_code,
        subtotal: (tli.quantity || 0) * (price || 0),
        price_source: pb_item_id ? "pricebook" : "template"
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
      pb_item_id = resolve_pricebook_item_id(tli)
      price = resolve_price(tli, pb_item_id)
      po.line_items.build(
        description: tli.description,
        quantity: tli.quantity,
        unit_price: price,
        gst_code: tli.gst_code || "GST",
        pricebook_item_id: pb_item_id,
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

    task = SmTask.new(
      job_id: job.id,
      sm_schedule_master_id: sm.id,
      task_number: sm.task_number || sm.id,
      sequence_order: sm.sequence_order,
      sync_key: sm.sync_key,
      critical_po: sm.critical_po,
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

  # Check if job already has tasks from this schedule template (idempotent guard)
  # A template is considered "applied" if >50% of its rows have matching tasks on the job
  def job_has_tasks_from_template?(template)
    template_row_ids = template.sm_schedule_master_rows.active.pluck(:id)
    return false if template_row_ids.empty?

    existing_count = SmTask.where(job_id: job.id, sm_schedule_master_id: template_row_ids).count
    existing_count > (template_row_ids.size / 2)
  end

  # Find the SmTask on this job that was created from the same SmScheduleMaster (preview only)
  def find_matching_task(template_item)
    return nil unless template_item.sm_schedule_master_id.present?

    SmTask.find_by(
      job_id: job.id,
      sm_schedule_master_id: template_item.sm_schedule_master_id
    )
  end

  # Resolve pricebook_item_id: use direct ID if present, fall back to lookup by item_code
  # (handles cross-tenant Config Sync where pricebook_item_code is synced but ID wasn't remapped)
  def resolve_pricebook_item_id(template_line_item)
    return template_line_item.pricebook_item_id if template_line_item.pricebook_item_id.present?

    if template_line_item.pricebook_item_code.present?
      PricebookItem.find_by(item_code: template_line_item.pricebook_item_code)&.id
    end
  end

  # Resolve price: use current pricebook price if available, fall back to template price
  def resolve_price(template_line_item, resolved_pb_item_id = nil)
    pb_item_id = resolved_pb_item_id || template_line_item.pricebook_item_id
    if pb_item_id.present?
      pricebook_item = PricebookItem.find_by(id: pb_item_id)
      if pricebook_item&.current_price.present? && pricebook_item.current_price > 0
        return pricebook_item.current_price
      end
    end

    template_line_item.unit_price || 0
  end
end
