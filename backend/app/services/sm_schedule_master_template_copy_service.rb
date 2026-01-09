# frozen_string_literal: true

# SmScheduleMasterTemplateCopyService - Copies an SmScheduleMasterTemplate to a Job as SmTasks
#
# This is a critical service that instantiates a template into actual tasks.
# It handles:
# - Creating SmTask records from SmScheduleMaster records
# - SSoT: Copying predecessor_ids jsonb from template to tasks
# - Calculating start/end dates based on dependencies
# - Optionally creating Purchase Orders for tasks that require them
#
# Usage:
#   result = SmScheduleMasterTemplateCopyService.new(template, job, options).execute
#
# Options:
#   user: User performing the copy (for audit trail)
#   start_date: The start date for the first task (default: today)
#   clear_existing: Clear existing tasks before copying (default: false)
#   create_purchase_orders: Create POs for tasks marked with create_po_on_job_start (default: false)
#
class SmScheduleMasterTemplateCopyService
  attr_reader :template, :job, :options, :errors

  def initialize(template, job, options = {})
    @template = template
    @job = job
    @options = options.with_indifferent_access
    @errors = []
    @created_tasks = []
    @created_dependencies = []
    @created_purchase_orders = [] # POs created from template auto-PO config
    @created_claim_stages = [] # JobClaimStages created from CLAIM tasks
    @tasks_needing_pos = [] # Tasks where template row had create_po_on_job_start but no supplier configured
    @task_number_map = {} # Maps template row task_number to created SmTask
    @row_map = {}         # Maps template row id to SmScheduleMaster
    @calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)
  end

  def execute
    return failure("Template is required") unless template.present?
    return failure("Job is required") unless job.present?

    # Build row lookup map
    template.sm_schedule_master_rows.active.in_sequence.each do |row|
      @row_map[row.id] = row
    end

    return failure("Template has no active rows") if @row_map.empty?

    ActiveRecord::Base.transaction do
      clear_existing_tasks if options[:clear_existing]

      # First pass: Create all tasks
      create_tasks

      # Second pass: Create dependencies
      create_dependencies

      # Third pass: Calculate dates based on dependencies
      calculate_dates

      # Fourth pass: Create POs for tasks with create_po_on_job_start
      create_purchase_orders

      # Fifth pass: Update PO descriptions with related supplier info
      update_related_po_descriptions

      if @errors.any?
        raise ActiveRecord::Rollback
      end
    end

    if @errors.any?
      failure(@errors.join("; "))
    else
      success
    end
  rescue StandardError => e
    Rails.logger.error "SmScheduleMasterTemplateCopyService error: #{e.message}\n#{e.backtrace.first(10).join("\n")}"
    failure("Copy failed: #{e.message}")
  end

  private

  def user
    @user ||= options[:user]
  end

  def start_date
    @start_date ||= begin
      date = options[:start_date]
      case date
      when Date then date
      when String then Date.parse(date)
      else Date.current
      end
    end
  end

  def clear_existing_tasks
    count = job.sm_tasks.count
    job.sm_tasks.destroy_all
    Rails.logger.info "SmScheduleMasterTemplateCopyService: Cleared #{count} existing tasks for job #{job.id}"
  end

  def create_tasks
    sequence = 0

    @row_map.values.sort_by(&:sequence_order).each do |row|
      sequence += 1

      task = SmTask.new(
        construction_id: job.id,
        sm_schedule_master_id: row.id,  # Link to SSoT SmScheduleMaster
        name: row.name,
        description: row.description,
        task_number: row.task_number,   # Use template's task_number (SSoT: equals template id)
        sequence_order: sequence,
        duration_days: row.duration_days,
        trade: row.trade,
        stage: row.stage,
        checklist_id: row.checklist_id,
        status: "not_started",
        # Task settings from template
        has_subtasks: row.has_subtasks,
        subtask_count: row.subtask_count,
        subtask_names: row.subtask_names,
        require_photo: row.require_photo,
        po_required: row.po_required,
        assigned_role: row.assigned_role,
        tags: row.tags,
        # PO spawn settings from template
        spawn_order_task: row.spawn_order_task,
        spawn_call_task: row.spawn_call_task,
        order_time_days: row.order_time_days,
        call_time_days: row.call_time_days,
        spawn_scan_task_id: row.spawn_scan_task_id,
        spawn_scan_lag_days: row.spawn_scan_lag_days,
        create_po_on_job_start: row.create_po_on_job_start,
        po_supplier_id: row.po_supplier_id,
        po_line_items: row.po_line_items,
        # Header/display settings
        allow_header: row.allow_header,
        header_gantt: row.header_gantt,
        color: row.color,
        cost_centre: row.cost_centre,
        # Workflow settings
        start_workflow_enabled: row.start_workflow_enabled,
        start_workflow_id: row.start_workflow_id,
        complete_workflow_enabled: row.complete_workflow_enabled,
        complete_workflow_id: row.complete_workflow_id,
        # Claim task settings (SSoT: Schedule Master defines claims)
        is_claim_task: row.is_claim_task,
        is_variation: row.is_variation,
        claim_percentage: row.claim_percentage,
        claim_invoice_pattern: row.claim_invoice_pattern,
        claim_invoice_template_id: row.claim_invoice_template_id,
        claim_trading_name_id: row.claim_trading_name_id,
        # Start with template row start_date offset, will be calculated later
        # For headers (duration 0), end_date = start_date to avoid validation error
        start_date: start_date,
        end_date: row.duration_days <= 1 ? start_date : @calendar.add_working_days(start_date, row.duration_days - 1),
        # Audit
        created_by: user,
        updated_by: user
      )

      if task.save
        @created_tasks << task
        @task_number_map[row.task_number] = task

        # Create JobClaimStage for CLAIM tasks (SSoT: Schedule Master defines claims)
        # Skip variations - they get claim stages when manually added to a job, not during initial sync
        if row.is_claim_task && row.claim_percentage.present? && !row.is_variation
          claim_stage = create_claim_stage_for_task(task, row, sequence)
          if claim_stage
            @created_claim_stages << claim_stage
          end
        end

        # Track tasks that need POs created (from template row setting)
        # Only add to tasks_needing_pos if no supplier is configured (needs manual setup)
        if row.create_po_on_job_start && row.po_supplier_id.blank?
          @tasks_needing_pos << task
        end
        Rails.logger.debug "SmScheduleMasterTemplateCopyService: Created task #{task.task_number}: #{task.name}"
      else
        @errors << "Row '#{row.name}': #{task.errors.full_messages.join(', ')}"
      end
    end
  end

  def create_dependencies
    # SSoT: Copy predecessor_ids from template directly
    # Since task_number = sm_schedule_master.id for both template and tasks,
    # predecessor_ids can be copied as-is (no remapping needed)
    @row_map.values.each do |row|
      next if row.predecessor_ids.blank?

      successor_task = @task_number_map[row.task_number]
      next unless successor_task

      # Copy predecessor_ids directly from template (no remapping needed)
      # The predecessor_ids reference task_numbers which equal sm_schedule_master.id
      successor_task.update!(predecessor_ids: row.predecessor_ids)
      @created_dependencies << {
        task_id: successor_task.id,
        predecessor_ids: row.predecessor_ids
      }
      Rails.logger.debug "SmScheduleMasterTemplateCopyService: Set predecessor_ids for task #{successor_task.task_number}"
    end
  end

  def calculate_dates
    # Sort tasks by their dependencies using topological sort
    sorted_tasks = topological_sort(@created_tasks)

    sorted_tasks.each do |task|
      # Calculate earliest start based on predecessors
      earliest_start = calculate_earliest_start(task)
      task.start_date = earliest_start
      # For headers (duration 0 or 1), end_date = start_date to avoid validation error
      task.end_date = task.duration_days <= 1 ? earliest_start : @calendar.add_working_days(earliest_start, task.duration_days - 1)
      task.save!
    end
  end

  def calculate_earliest_start(task)
    # SSoT: Using jsonb-based predecessor lookup
    predecessor_deps = task.active_predecessor_dependencies

    if predecessor_deps.empty?
      return start_date
    end

    earliest = predecessor_deps.map do |dep|
      pred = dep.predecessor_task
      case dep.dependency_type
      when "FS" # Finish-to-Start: successor starts after predecessor ends
        @calendar.add_working_days(pred.end_date, dep.lag_days + 1)
      when "SS" # Start-to-Start: successor starts when predecessor starts
        @calendar.add_working_days(pred.start_date, dep.lag_days)
      when "FF" # Finish-to-Finish: successor ends when predecessor ends
        # Work backwards from when predecessor finishes
        target_end = @calendar.add_working_days(pred.end_date, dep.lag_days)
        @calendar.subtract_working_days(target_end, task.duration_days - 1)
      when "SF" # Start-to-Finish: successor ends when predecessor starts
        target_end = @calendar.add_working_days(pred.start_date, dep.lag_days)
        @calendar.subtract_working_days(target_end, task.duration_days - 1)
      else
        @calendar.add_working_days(pred.end_date, dep.lag_days + 1)
      end
    end.max

    # Ensure we don't go before the project start date
    [earliest, start_date].max
  end

  def topological_sort(tasks)
    # Build dependency graph from predecessor_ids jsonb
    task_by_id = tasks.index_by(&:id)
    task_by_number = tasks.index_by(&:task_number)
    in_degree = Hash.new(0)
    adjacency = Hash.new { |h, k| h[k] = [] }

    tasks.each do |task|
      in_degree[task.id] ||= 0
    end

    # SSoT: Build graph from predecessor_ids jsonb on each task
    tasks.each do |task|
      next if task.predecessor_ids.blank?

      task.predecessor_ids.each do |pred_data|
        pred_task_number = (pred_data["id"] || pred_data[:id]).to_i
        predecessor = task_by_number[pred_task_number]
        next unless predecessor && task_by_id[predecessor.id] # predecessor must be in our set

        adjacency[predecessor.id] << task.id
        in_degree[task.id] += 1
      end
    end

    # Kahn's algorithm
    queue = tasks.select { |t| in_degree[t.id] == 0 }
    sorted = []

    while queue.any?
      task = queue.shift
      sorted << task

      adjacency[task.id].each do |successor_id|
        in_degree[successor_id] -= 1
        if in_degree[successor_id] == 0
          successor = task_by_id[successor_id]
          queue << successor if successor
        end
      end
    end

    # If we couldn't sort all tasks, there's a cycle - fall back to sequence order
    if sorted.length != tasks.length
      Rails.logger.warn "SmScheduleMasterTemplateCopyService: Detected dependency cycle, using sequence order"
      return tasks.sort_by(&:sequence_order)
    end

    sorted
  end

  def create_purchase_orders
    return if options[:create_purchase_orders] == false

    # Find template rows with auto-PO configured (supplier set)
    @row_map.values.each do |row|
      next unless row.create_po_on_job_start
      next if row.po_supplier_id.blank?

      task = @task_number_map[row.task_number]
      next unless task

      begin
        po = create_po_for_task(task, row)
        if po
          @created_purchase_orders << po
          Rails.logger.info "SmScheduleMasterTemplateCopyService: Created PO #{po.purchase_order_number} for task #{task.task_number}: #{task.name}"
        end
      rescue StandardError => e
        Rails.logger.error "SmScheduleMasterTemplateCopyService: Failed to create PO for task #{task.id}: #{e.message}"
        @errors << "Auto-PO for '#{row.name}': #{e.message}"
      end
    end
  end

  def create_po_for_task(task, template_row)
    # Create the Purchase Order
    po = PurchaseOrder.new(
      job_id: job.id,
      supplier_id: template_row.po_supplier_id,
      status: "draft",
      description: "Auto-created from template: #{template_row.name}",
      required_date: task.start_date,
      created_by_id: user&.id
    )

    unless po.save
      raise "PO creation failed: #{po.errors.full_messages.join(', ')}"
    end

    # Create line items from po_line_items (current pricebook prices)
    if template_row.po_line_items.present?
      line_number = 0
      template_row.po_line_items.each do |item|
        item_id = item["pricebook_item_id"] || item[:pricebook_item_id]
        qty = item["qty"] || item[:qty] || 1
        next unless item_id

        pricebook_item = PricebookItem.find_by(id: item_id)
        next unless pricebook_item

        line_number += 1
        line_item = po.line_items.build(
          line_number: line_number,
          description: pricebook_item.item_name,
          quantity: qty,
          unit_price: pricebook_item.current_price || 0,
          pricebook_item_id: pricebook_item.id,
          gst_code: pricebook_item.gst_code || "GST"
        )

        unless line_item.save
          Rails.logger.warn "SmScheduleMasterTemplateCopyService: Line item creation failed: #{line_item.errors.full_messages.join(', ')}"
        end
      end
    end

    # SSoT: Link PO to task via sm_task_id (Option B - single column)
    po.update!(sm_task_id: task.id)

    # Spawn Order/Call tasks if configured on the task
    spawn_result = SmPoSpawnService.new(task, user: user).spawn!
    if spawn_result[:spawned_tasks].any?
      Rails.logger.info "SmScheduleMasterTemplateCopyService: Spawned #{spawn_result[:spawned_tasks].count} Order/Call tasks for PO #{po.purchase_order_number}"
      @created_tasks.concat(spawn_result[:spawned_tasks])
    end

    po
  end

  # Fifth pass: Update PO descriptions with related supplier contact info
  # This runs after all POs are created so we can reference their PO numbers
  def update_related_po_descriptions
    return if @created_purchase_orders.empty?

    @created_purchase_orders.each do |po|
      template_row = po.sm_task&.sm_schedule_master
      next unless template_row&.related_po_tasks&.any?

      related_info = build_related_po_info(po, template_row)
      next if related_info.blank?

      # Append related info to existing description
      new_description = [po.description, related_info].compact.join("\n\n")
      po.update!(description: new_description)
      Rails.logger.info "SmScheduleMasterTemplateCopyService: Added related PO info to #{po.purchase_order_number}"
    end
  end

  # Build the related supplier contact section for a PO description
  def build_related_po_info(po, template_row)
    related_entries = template_row.related_po_tasks.filter_map do |related_template|
      # Find the PO created for this related template row on the same job
      related_task = job.sm_tasks.find_by(sm_schedule_master_id: related_template.id)
      related_po = related_task&.purchase_order
      next unless related_po

      supplier = related_po.supplier
      phone = supplier&.contact_phones&.first&.phone_number

      "📦 #{related_po.purchase_order_number} - #{related_template.name}\n" \
      "   Supplier: #{supplier&.display_name || 'TBD'}\n" \
      "   Phone: #{phone || 'N/A'}"
    end

    return nil if related_entries.empty?

    separator = "═" * 43
    [
      separator,
      "RELATED SUPPLIER CONTACTS FOR COORDINATION",
      separator,
      "",
      related_entries.join("\n\n"),
      "",
      separator
    ].join("\n")
  end

  # SSoT: Create or reuse JobClaimStage from CLAIM task template row
  # Schedule Master defines claims - when template is copied, claim stages are auto-created
  # If a claim stage with the same name exists (with invoice links), it's reused to preserve them
  def create_claim_stage_for_task(task, template_row, sequence_order)
    # Extract clean claim name (strip "CLAIM - " prefix if present)
    claim_name = template_row.claim_stage_name

    # Check for existing claim stage with same name (preserve matched invoices)
    existing_stage = job.job_claim_stages.find_by(name: claim_name)
    if existing_stage
      # Update the existing stage with template values (percentage may have changed)
      existing_stage.update!(
        percentage: template_row.claim_percentage,
        invoice_match_pattern: template_row.claim_invoice_pattern,
        sequence_order: sequence_order,
        claim_sequence_number: template_row.claim_sequence_number
      )
      # Link the task to the existing claim stage
      task.update!(job_claim_stage_id: existing_stage.id)
      Rails.logger.info "SmScheduleMasterTemplateCopyService: Re-linked existing claim stage '#{claim_name}' to task #{task.task_number}"
      return existing_stage
    end

    # Calculate expected amount from job's contract price
    expected_amount = if job.contract_price.present? && job.contract_price > 0
                        (job.contract_price * template_row.claim_percentage / 100).round(2)
                      else
                        0 # Will be recalculated when contract price is set
                      end

    # SSoT: JobClaimStage created from Schedule Master CLAIM task
    # ClaimStageTemplate system removed - this is THE ONE source for claim stages
    claim_stage = JobClaimStage.new(
      job_id: job.id,
      name: claim_name,
      percentage: template_row.claim_percentage,
      expected_amount: expected_amount,
      sequence_order: sequence_order,
      is_custom: false, # Created from Schedule Master template, not manually
      match_status: "unmatched",
      payment_status: "pending",
      # SSoT: claim_sequence_number for J{job}-{seq} invoice matching
      claim_sequence_number: template_row.claim_sequence_number
    )

    if claim_stage.save
      # Link the task to the claim stage (bidirectional)
      task.update!(job_claim_stage_id: claim_stage.id)
      Rails.logger.info "SmScheduleMasterTemplateCopyService: Created claim stage '#{claim_name}' (#{template_row.claim_percentage}%) for task #{task.task_number}"
      claim_stage
    else
      @errors << "Claim stage for '#{template_row.name}': #{claim_stage.errors.full_messages.join(', ')}"
      nil
    end
  end

  def success
    {
      success: true,
      job_id: job.id,
      template_id: template.id,
      tasks_created: @created_tasks.count,
      dependencies_created: @created_dependencies.count,
      purchase_orders_created: @created_purchase_orders.count,
      claim_stages_created: @created_claim_stages.count,
      tasks: @created_tasks,
      dependencies: @created_dependencies,
      purchase_orders: @created_purchase_orders.map { |po|
        {
          id: po.id,
          purchase_order_number: po.purchase_order_number,
          supplier_name: po.supplier&.name,
          total: po.total,
          line_items_count: po.line_items.count
        }
      },
      claim_stages: @created_claim_stages.map { |cs|
        {
          id: cs.id,
          name: cs.name,
          percentage: cs.percentage,
          expected_amount: cs.expected_amount,
          sm_task_id: cs.sm_task&.id
        }
      },
      tasks_needing_pos: @tasks_needing_pos.map { |t|
        { id: t.id, name: t.name, task_number: t.task_number }
      },
      errors: [],
      summary: {
        template_name: template.name,
        job_name: job.name,
        start_date: start_date.to_s,
        task_count: @created_tasks.count,
        dependency_count: @created_dependencies.count,
        purchase_orders_created: @created_purchase_orders.count,
        claim_stages_created: @created_claim_stages.count,
        tasks_needing_pos_count: @tasks_needing_pos.count
      }
    }
  end

  def failure(message)
    {
      success: false,
      tasks_created: 0,
      dependencies_created: 0,
      errors: Array(message) + @errors
    }
  end
end
