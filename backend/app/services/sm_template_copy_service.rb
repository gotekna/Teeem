# frozen_string_literal: true

# SmTemplateCopyService - Copies an SmTemplate to a construction as SmTasks
#
# Usage:
#   result = SmTemplateCopyService.new(template, construction, options).execute
#
# Options:
#   start_date: Date to start the schedule (default: Date.current)
#   user: User performing the action (for audit trail)
#   clear_existing: Boolean to delete existing tasks first (default: false)
#
# Returns:
#   { success: true, tasks: [...], dependencies: [...], summary: {...} }
#   or
#   { success: false, errors: [...] }
#
class SmTemplateCopyService
  attr_reader :template, :construction, :options, :errors

  def initialize(template, construction, options = {})
    @template = template
    @construction = construction
    @options = options.with_indifferent_access
    @errors = []
    @created_tasks = []
    @created_dependencies = []
    @task_number_to_task_map = {} # Maps template task_number to created SmTask
  end

  def execute
    return failure("Template is required") unless template.present?
    return failure("Construction (Job) is required") unless construction.present?

    ActiveRecord::Base.transaction do
      clear_existing_tasks if options[:clear_existing]
      create_tasks_from_template
      create_dependencies

      if errors.any?
        raise ActiveRecord::Rollback
      end
    end

    if errors.any?
      failure(errors.join(", "))
    else
      success
    end
  rescue StandardError => e
    Rails.logger.error "SmTemplateCopyService error: #{e.message}\n#{e.backtrace.first(10).join("\n")}"
    failure("Failed to copy template: #{e.message}")
  end

  private

  def start_date
    @start_date ||= (options[:start_date] || Date.current).to_date
  end

  def user
    @user ||= options[:user]
  end

  def clear_existing_tasks
    existing_count = construction.sm_tasks.count
    construction.sm_tasks.destroy_all
    Rails.logger.info "SmTemplateCopyService: Cleared #{existing_count} existing tasks"
  end

  def create_tasks_from_template
    rows = template.ordered_rows
    return if rows.empty?

    # First pass: Create all tasks (without dependencies)
    rows.each_with_index do |row, index|
      task = create_task_from_row(row, index)
      if task.persisted?
        @created_tasks << task
        @task_number_to_task_map[row.task_number] = task
      else
        errors << "Failed to create task '#{row.name}': #{task.errors.full_messages.join(', ')}"
      end
    end
  end

  def create_task_from_row(row, index)
    # Calculate task dates
    task_start_date = calculate_task_start_date(row, index)
    task_end_date = task_start_date + (row.duration_days - 1).days

    SmTask.create!(
      # Core fields - using job_id (not construction_id, per schema)
      job_id: construction.id,
      name: row.name,
      task_number: row.task_number,
      sequence_order: row.sequence_order,

      # Dates
      start_date: task_start_date,
      end_date: task_end_date,
      duration_days: row.duration_days,

      # Status
      status: "not_started",

      # From template row
      trade: row.trade,
      stage: row.stage,
      description: row.description,

      # Supplier (if specified in template)
      supplier_id: row.supplier_id,

      # Photo requirements
      require_photo: row.require_photo || false,

      # Certification
      require_certificate: row.require_certificate || false,
      require_supervisor_check: row.require_supervisor_check || false,

      # PO
      po_required: row.po_required || false,
      critical_po: row.critical_po || false,

      # Spawning
      spawn_photo_task: row.spawn_photo_task || false,
      spawn_scan_task: row.spawn_scan_task || false,
      spawn_office_tasks: row.spawn_office_tasks || [],
      pass_fail_enabled: row.pass_fail_enabled || false,

      # Timing
      order_time_days: row.order_time_days,
      call_time_days: row.call_time_days,

      # Checklist
      checklist_id: row.checklist_id,

      # Documentation
      documentation_category_ids: row.documentation_category_ids || [],
      show_in_docs_tab: row.show_in_docs_tab || false,
      linked_task_ids: [], # Will be populated when dependencies are created

      # Parent task (if hierarchical)
      parent_task_id: resolve_parent_task_id(row),

      # Template reference (for tracking which template row created this)
      template_row_id: row.id,

      # Audit
      created_by_id: user&.id,
      updated_by_id: user&.id
    )
  rescue ActiveRecord::RecordInvalid => e
    # Return an unsaved task with errors for the caller to handle
    task = SmTask.new
    task.errors.add(:base, e.message)
    task
  end

  def calculate_task_start_date(row, _index)
    # If row has predecessors, we'll calculate based on predecessor end dates later
    # For now, use start_date + offset
    # In a more advanced version, we'd use a forward pass scheduling algorithm

    if row.predecessor_ids.present? && row.predecessor_ids.any?
      # For tasks with predecessors, calculate based on max predecessor end date
      # This is a simplified version - full implementation would handle all dependency types
      predecessor_task_numbers = row.predecessor_ids.map { |p| p["id"] || p[:id] }
      predecessor_tasks = predecessor_task_numbers.map { |tn| @task_number_to_task_map[tn] }.compact

      if predecessor_tasks.any?
        max_end_date = predecessor_tasks.map(&:end_date).max
        # FS (Finish-to-Start) is default - start after predecessor ends
        # Add lag if specified
        first_pred = row.predecessor_ids.first
        lag = (first_pred["lag"] || first_pred[:lag] || 0).to_i
        return max_end_date + 1.day + lag.days
      end
    end

    # No predecessors or predecessors not found - use start_date
    start_date
  end

  def resolve_parent_task_id(row)
    return nil unless row.parent_row_id.present?

    parent_row = template.sm_template_rows.find_by(id: row.parent_row_id)
    return nil unless parent_row

    @task_number_to_task_map[parent_row.task_number]&.id
  end

  def create_dependencies
    template.ordered_rows.each do |row|
      next unless row.predecessor_ids.present?

      successor_task = @task_number_to_task_map[row.task_number]
      next unless successor_task

      row.predecessor_ids.each do |pred_data|
        pred_task_number = pred_data["id"] || pred_data[:id]
        predecessor_task = @task_number_to_task_map[pred_task_number]
        next unless predecessor_task

        dependency = SmDependency.create(
          predecessor_task_id: predecessor_task.id,
          successor_task_id: successor_task.id,
          dependency_type: pred_data["type"] || pred_data[:type] || "FS",
          lag_days: (pred_data["lag"] || pred_data[:lag] || 0).to_i,
          active: true,
          created_by_id: user&.id
        )

        if dependency.persisted?
          @created_dependencies << dependency
        else
          errors << "Failed to create dependency: #{dependency.errors.full_messages.join(', ')}"
        end
      end
    end
  end

  def success
    {
      success: true,
      tasks: @created_tasks,
      dependencies: @created_dependencies,
      summary: {
        template_name: template.name,
        construction_name: construction.name,
        tasks_created: @created_tasks.count,
        dependencies_created: @created_dependencies.count,
        start_date: start_date,
        end_date: @created_tasks.map(&:end_date).max
      }
    }
  end

  def failure(message)
    {
      success: false,
      errors: Array(message)
    }
  end
end
