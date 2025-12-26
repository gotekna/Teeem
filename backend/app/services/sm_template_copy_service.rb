# frozen_string_literal: true

# SmTemplateCopyService - Copies an SmTemplate to a Job as SmTasks
#
# This is a critical service that instantiates a template into actual tasks.
# It handles:
# - Creating SmTask records from SmScheduleMaster records
# - Creating SmDependency records based on predecessor relationships
# - Calculating start/end dates based on dependencies
# - Optionally creating Purchase Orders for tasks that require them
#
# Usage:
#   result = SmTemplateCopyService.new(template, job, options).execute
#
# Options:
#   user: User performing the copy (for audit trail)
#   start_date: The start date for the first task (default: today)
#   clear_existing: Clear existing tasks before copying (default: false)
#   create_purchase_orders: Create POs for tasks marked with create_po_on_job_start (default: false)
#
class SmTemplateCopyService
  attr_reader :template, :job, :options, :errors

  def initialize(template, job, options = {})
    @template = template
    @job = job
    @options = options.with_indifferent_access
    @errors = []
    @created_tasks = []
    @created_dependencies = []
    @created_purchase_orders = [] # POs created from template auto-PO config
    @tasks_needing_pos = [] # Tasks where template row had create_po_on_job_start but no supplier configured
    @task_number_map = {} # Maps template row task_number to created SmTask
    @row_map = {}         # Maps template row id to SmScheduleMaster
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
    Rails.logger.error "SmTemplateCopyService error: #{e.message}\n#{e.backtrace.first(10).join("\n")}"
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
    Rails.logger.info "SmTemplateCopyService: Cleared #{count} existing tasks for job #{job.id}"
  end

  def create_tasks
    sequence = 0
    max_task_number = job.sm_tasks.maximum(:task_number) || 0

    @row_map.values.sort_by(&:sequence_order).each do |row|
      sequence += 1
      task_number = max_task_number + sequence

      task = SmTask.new(
        construction_id: job.id,
        sm_schedule_master_id: row.id,  # Link to SSoT SmScheduleMaster
        name: row.name,
        description: row.description,
        task_number: task_number,
        sequence_order: sequence,
        duration_days: row.duration_days,
        trade: row.trade,
        stage: row.stage,
        checklist_id: row.checklist_id,
        status: "not_started",
        # Spawn/cert settings from template
        spawn_type: row.spawn_type,
        spawn_on: row.spawn_on,
        spawn_per_item: row.spawn_per_item,
        spawn_prefix: row.spawn_prefix,
        cert_lag_days: row.cert_lag_days,
        has_subtasks: row.has_subtasks,
        subtask_count: row.subtask_count,
        subtask_names: row.subtask_names,
        require_photo: row.require_photo,
        require_voice_note: row.require_voice_note,
        po_required: row.po_required,
        assignable_role: row.assignable_role,
        tags: row.tags,
        # Start with template row start_date offset, will be calculated later
        start_date: start_date,
        end_date: start_date + (row.duration_days - 1).days,
        # Audit
        created_by: user,
        updated_by: user
      )

      if task.save
        @created_tasks << task
        @task_number_map[row.task_number] = task
        # Track tasks that need POs created (from template row setting)
        # Only add to tasks_needing_pos if no supplier is configured (needs manual setup)
        if row.create_po_on_job_start && row.po_supplier_id.blank?
          @tasks_needing_pos << task
        end
        Rails.logger.debug "SmTemplateCopyService: Created task #{task.task_number}: #{task.name}"
      else
        @errors << "Row '#{row.name}': #{task.errors.full_messages.join(', ')}"
      end
    end
  end

  def create_dependencies
    @row_map.values.each do |row|
      next if row.predecessor_ids.blank?

      successor_task = @task_number_map[row.task_number]
      next unless successor_task

      row.predecessor_ids.each do |pred_data|
        pred_task_number = pred_data["id"] || pred_data[:id]
        predecessor_task = @task_number_map[pred_task_number]
        next unless predecessor_task

        dep_type = pred_data["type"] || pred_data[:type] || "FS"
        lag_days = (pred_data["lag"] || pred_data[:lag] || 0).to_i

        dependency = SmDependency.new(
          predecessor_task_id: predecessor_task.id,
          successor_task_id: successor_task.id,
          dependency_type: dep_type,
          lag_days: lag_days,
          active: true,
          created_by: user
        )

        if dependency.save
          @created_dependencies << dependency
          Rails.logger.debug "SmTemplateCopyService: Created dependency #{predecessor_task.task_number} -> #{successor_task.task_number}"
        else
          @errors << "Dependency #{predecessor_task.name} -> #{successor_task.name}: #{dependency.errors.full_messages.join(', ')}"
        end
      end
    end
  end

  def calculate_dates
    # Sort tasks by their dependencies using topological sort
    sorted_tasks = topological_sort(@created_tasks)

    sorted_tasks.each do |task|
      # Calculate earliest start based on predecessors
      earliest_start = calculate_earliest_start(task)
      task.start_date = earliest_start
      task.end_date = earliest_start + (task.duration_days - 1).days
      task.save!
    end
  end

  def calculate_earliest_start(task)
    predecessor_deps = SmDependency.where(successor_task_id: task.id, active: true).includes(:predecessor_task)

    if predecessor_deps.empty?
      return start_date
    end

    earliest = predecessor_deps.map do |dep|
      pred = dep.predecessor_task
      case dep.dependency_type
      when "FS" # Finish-to-Start: successor starts after predecessor ends
        pred.end_date + 1.day + dep.lag_days.days
      when "SS" # Start-to-Start: successor starts when predecessor starts
        pred.start_date + dep.lag_days.days
      when "FF" # Finish-to-Finish: successor ends when predecessor ends
        pred.end_date - (task.duration_days - 1).days + dep.lag_days.days
      when "SF" # Start-to-Finish: successor ends when predecessor starts
        pred.start_date - (task.duration_days - 1).days + dep.lag_days.days
      else
        pred.end_date + 1.day + dep.lag_days.days
      end
    end.max

    # Ensure we don't go before the project start date
    [earliest, start_date].max
  end

  def topological_sort(tasks)
    # Build dependency graph
    task_by_id = tasks.index_by(&:id)
    in_degree = Hash.new(0)
    adjacency = Hash.new { |h, k| h[k] = [] }

    tasks.each do |task|
      in_degree[task.id] ||= 0
    end

    SmDependency.where(successor_task_id: tasks.map(&:id), active: true).find_each do |dep|
      next unless task_by_id[dep.predecessor_task_id] # predecessor must be in our set

      adjacency[dep.predecessor_task_id] << dep.successor_task_id
      in_degree[dep.successor_task_id] += 1
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
      Rails.logger.warn "SmTemplateCopyService: Detected dependency cycle, using sequence order"
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
          Rails.logger.info "SmTemplateCopyService: Created PO #{po.purchase_order_number} for task #{task.task_number}: #{task.name}"
        end
      rescue StandardError => e
        Rails.logger.error "SmTemplateCopyService: Failed to create PO for task #{task.id}: #{e.message}"
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

    # Create line items from price history IDs
    if template_row.po_price_history_ids.present?
      line_number = 0
      template_row.po_price_history_ids.each do |ph_id|
        price_history = PriceHistory.find_by(id: ph_id)
        next unless price_history

        line_number += 1
        pricebook_item = price_history.pricebook_item

        line_item = po.line_items.build(
          line_number: line_number,
          description: pricebook_item&.item_name || "Item from price history",
          quantity: 1,
          unit_price: price_history.new_price || pricebook_item&.current_price || 0,
          pricebook_item_id: price_history.pricebook_item_id,
          gst_code: pricebook_item&.gst_code || "GST"
        )

        unless line_item.save
          Rails.logger.warn "SmTemplateCopyService: Line item creation failed: #{line_item.errors.full_messages.join(', ')}"
        end
      end
    end

    # Link the task to this PO
    task.update!(purchase_order_id: po.id)

    po
  end

  def success
    {
      success: true,
      job_id: job.id,
      template_id: template.id,
      tasks_created: @created_tasks.count,
      dependencies_created: @created_dependencies.count,
      purchase_orders_created: @created_purchase_orders.count,
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
