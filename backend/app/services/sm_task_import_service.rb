# frozen_string_literal: true

# SmTaskImportService - Imports SmTasks from Excel/CSV files
#
# Usage:
#   result = SmTaskImportService.new(job, file_path, options).execute
#
# Options:
#   user: User performing the import (for audit trail)
#   clear_existing: Boolean to delete existing tasks first (default: false)
#
# Supported columns (case-insensitive):
#   - Task Number / task_number / #
#   - Name / Title / Task Name
#   - Description
#   - Start Date / Start / start_date
#   - End Date / End / Complete Date / end_date
#   - Duration / Duration Days / duration_days
#   - Status (not_started, started, completed)
#   - Trade / Category / supplier_category
#   - Stage
#   - Supplier / Supplier Name
#   - Predecessors (comma-separated task numbers, e.g., "1,2,3" or "1+1d,2")
#   - Confirm (Yes/No)
#   - Supplier Confirm (Yes/No)
#
# Returns:
#   { success: true, imported_count: N, tasks: [...], dependencies: [...], errors: [...] }
#   or
#   { success: false, errors: [...] }
#
class SmTaskImportService
  attr_reader :job, :file_path, :options, :errors

  # Column name mappings (lowercase key => SmTask attribute)
  COLUMN_MAPPINGS = {
    # Task identification
    "task number" => :task_number,
    "task_number" => :task_number,
    "#" => :task_number,
    "number" => :task_number,

    # Name
    "name" => :name,
    "title" => :name,
    "task name" => :name,
    "task_name" => :name,
    "task" => :name,

    # Description
    "description" => :description,
    "notes" => :description,

    # Dates
    "start date" => :start_date,
    "start_date" => :start_date,
    "start" => :start_date,
    "end date" => :end_date,
    "end_date" => :end_date,
    "end" => :end_date,
    "complete date" => :end_date,
    "complete_date" => :end_date,
    "complete" => :end_date,

    # Duration
    "duration" => :duration_days,
    "duration days" => :duration_days,
    "duration_days" => :duration_days,
    "days" => :duration_days,

    # Status
    "status" => :status,

    # Trade/Stage
    "trade" => :trade,
    "category" => :trade,
    "supplier category" => :trade,
    "supplier_category" => :trade,
    "stage" => :stage,

    # Supplier (by name - will be matched to Contact)
    "supplier" => :supplier_name,
    "supplier name" => :supplier_name,
    "supplier_name" => :supplier_name,

    # Dependencies
    "predecessors" => :predecessors,
    "predecessor" => :predecessors,
    "dependencies" => :predecessors,
    "depends on" => :predecessors,

    # Locks
    "confirm" => :confirm,
    "supplier confirm" => :supplier_confirm,
    "supplier_confirm" => :supplier_confirm
  }.freeze

  def initialize(job, file_path, options = {})
    @job = job
    @file_path = file_path
    @options = options.with_indifferent_access
    @errors = []
    @created_tasks = []
    @created_dependencies = []
    @task_number_to_task = {} # Maps imported task_number to created SmTask
    @supplier_cache = {} # Cache for supplier lookups
    @calendar = WorkingDaysCalculator.new(TenantSetting.instance)
  end

  def execute
    return failure("Job is required") unless job.present?
    return failure("File path is required") unless file_path.present?

    parser = SpreadsheetParser.new(file_path)
    parse_result = parser.parse

    unless parse_result[:success]
      return failure(parse_result[:errors].join(", "))
    end

    rows = parser.all_rows
    return failure("No data rows found in file") if rows.empty?

    ActiveRecord::Base.transaction do
      clear_existing_tasks if options[:clear_existing]

      # First pass: Create all tasks
      rows.each_with_index do |row, index|
        create_task_from_row(row, index)
      end

      # Second pass: Create dependencies (after all tasks exist)
      create_dependencies_from_rows(rows)

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
    Rails.logger.error "SmTaskImportService error: #{e.message}\n#{e.backtrace.first(10).join("\n")}"
    failure("Import failed: #{e.message}")
  end

  private

  def user
    @user ||= options[:user]
  end

  def clear_existing_tasks
    count = job.sm_tasks.count
    job.sm_tasks.destroy_all
    Rails.logger.info "SmTaskImportService: Cleared #{count} existing tasks"
  end

  def create_task_from_row(row, index)
    # Parse row into attributes
    attrs = parse_row(row, index)

    # Skip rows without a name
    unless attrs[:name].present?
      Rails.logger.debug "SmTaskImportService: Skipping row #{index + 1} (no name)"
      return
    end

    # Create the task
    # SSoT: Multi-tenancy - set tenant_id from job (background job has no tenant context)
    task = SmTask.new(
      job_id: job.id,
      name: attrs[:name],
      description: attrs[:description],
      task_number: attrs[:task_number] || (job.sm_tasks.maximum(:task_number) || 0) + @created_tasks.count + 1,
      sequence_order: index + 1,
      start_date: attrs[:start_date] || Date.current,
      duration_days: attrs[:duration_days] || 1,
      status: normalize_status(attrs[:status]),
      trade: attrs[:trade],
      stage: attrs[:stage],
      supplier_id: lookup_supplier(attrs[:supplier_name]),
      confirm: parse_boolean(attrs[:confirm]),
      supplier_confirm: parse_boolean(attrs[:supplier_confirm]),
      created_by_id: user&.id,
      updated_by_id: user&.id,
      tenant_id: job&.tenant_id
    )

    # Calculate end_date if not provided
    if attrs[:end_date].present?
      task.end_date = attrs[:end_date]
      # Recalculate duration if we have both dates
      if task.start_date.present?
        task.duration_days = (task.end_date - task.start_date).to_i + 1
      end
    else
      task.end_date = @calendar.add_working_days(task.start_date, task.duration_days - 1)
    end

    if task.save
      @created_tasks << task
      @task_number_to_task[task.task_number] = task
      Rails.logger.debug "SmTaskImportService: Created task #{task.task_number}: #{task.name}"
    else
      @errors << "Row #{index + 2}: #{task.errors.full_messages.join(', ')}"
    end
  rescue StandardError => e
    @errors << "Row #{index + 2}: #{e.message}"
  end

  def parse_row(row, _index)
    attrs = {}

    row.each do |header, value|
      next if header.blank? || value.blank?

      # Find the SmTask attribute for this column
      column_key = header.to_s.downcase.strip
      attribute = COLUMN_MAPPINGS[column_key]

      next unless attribute

      # Parse value based on attribute type
      attrs[attribute] = case attribute
      when :start_date, :end_date
        parse_date(value)
      when :duration_days, :task_number
        parse_integer(value)
      when :confirm, :supplier_confirm
        value # Will be parsed as boolean later
      when :predecessors
        value # Will be parsed in second pass
      else
        value.to_s.strip
      end
    end

    # Store raw predecessors for second pass
    @row_predecessors ||= {}
    @row_predecessors[attrs[:task_number]] = attrs.delete(:predecessors)

    attrs
  end

  def create_dependencies_from_rows(rows)
    return if @row_predecessors.blank?

    # SSoT: Build predecessor_ids jsonb for each task
    @row_predecessors.each do |task_number, predecessors_value|
      next if predecessors_value.blank?
      task = @task_number_to_task[task_number]
      next unless task

      parsed_predecessors = parse_predecessors(predecessors_value)
      predecessor_ids = []

      parsed_predecessors.each do |pred_data|
        predecessor_task = @task_number_to_task[pred_data[:id]]
        next unless predecessor_task

        predecessor_ids << {
          "id" => predecessor_task.task_number,
          "type" => pred_data[:type] || "FS",
          "lag" => pred_data[:lag] || 0
        }
      end

      if predecessor_ids.any?
        task.update!(predecessor_ids: predecessor_ids)
        @created_dependencies << {
          task_id: task.id,
          predecessor_ids: predecessor_ids
        }
      end
    end
  end

  def parse_date(value)
    return nil if value.blank?

    if value.is_a?(Date) || value.is_a?(DateTime) || value.is_a?(Time)
      value.to_date
    elsif value.is_a?(Numeric)
      # Excel serial date
      Date.new(1899, 12, 30) + value.to_i.days
    elsif value.is_a?(String)
      begin
        Date.parse(value)
      rescue ArgumentError
        nil
      end
    else
      nil
    end
  end

  def parse_integer(value)
    return nil if value.blank?

    if value.is_a?(Numeric)
      value.to_i
    elsif value.is_a?(String)
      # Handle duration strings like "5d", "3 days"
      if value =~ /^(\d+)\s*d(ays?)?$/i
        $1.to_i
      else
        value.to_i
      end
    else
      nil
    end
  end

  def parse_boolean(value)
    return false if value.blank?

    if value.is_a?(TrueClass) || value.is_a?(FalseClass)
      value
    elsif value.is_a?(String)
      %w[yes true 1 y].include?(value.downcase.strip)
    else
      !!value
    end
  end

  def normalize_status(value)
    return "not_started" if value.blank?

    case value.to_s.downcase.strip
    when "not started", "not_started", "pending", "new"
      "not_started"
    when "started", "in progress", "in_progress", "active"
      "started"
    when "completed", "complete", "done", "finished"
      "completed"
    else
      "not_started"
    end
  end

  def parse_predecessors(value)
    return [] if value.blank?
    return value if value.is_a?(Array)

    predecessors = []
    value_str = value.to_s.strip

    # Split by comma to handle multiple dependencies
    parts = value_str.split(",").map(&:strip)

    parts.each do |part|
      # Handle various formats:
      # "5" -> task 5, FS, 0 lag
      # "5+1d" -> task 5, FS, 1 day lag
      # "5FS" -> task 5, FS, 0 lag
      # "5SS+2d" -> task 5, SS, 2 day lag
      # "5/6" -> tasks 5 and 6

      if part.include?("/")
        # Multiple dependencies like "5/6"
        part.split("/").map(&:strip).each do |sub|
          predecessors << parse_single_predecessor(sub)
        end
      else
        predecessors << parse_single_predecessor(part)
      end
    end

    predecessors.compact
  end

  def parse_single_predecessor(dep_str)
    return nil if dep_str.blank?

    dep_str = dep_str.strip

    # Pattern: task_number + optional dependency_type + optional lag
    # Examples: "5", "5+1d", "5FS", "5FS+2d", "5SS+1d"
    if dep_str =~ /^(\d+)([A-Z]{2})?\s*(\+\d+[a-z]+)?$/i
      task_id = $1.to_i
      dep_type = $2&.upcase || "FS"
      lag_str = $3

      lag_days = 0
      if lag_str =~ /\+(\d+)([a-z]+)/i
        lag_days = $1.to_i
      end

      return nil if task_id <= 0

      { id: task_id, type: dep_type, lag: lag_days }
    elsif dep_str =~ /^(\d+)$/
      # Just a number
      task_id = $1.to_i
      return nil if task_id <= 0
      { id: task_id, type: "FS", lag: 0 }
    else
      nil
    end
  end

  def lookup_supplier(supplier_name)
    return nil if supplier_name.blank?

    # Check cache first
    return @supplier_cache[supplier_name] if @supplier_cache.key?(supplier_name)

    # Find supplier by name (Contact with type 'Supplier')
    supplier = Contact.where("LOWER(name) = ?", supplier_name.downcase.strip)
                      .where(contact_type: %w[supplier Supplier])
                      .first

    @supplier_cache[supplier_name] = supplier&.id
  end

  def success
    {
      success: true,
      imported_count: @created_tasks.count,
      dependencies_count: @created_dependencies.count,
      tasks: @created_tasks,
      dependencies: @created_dependencies,
      errors: @errors,
      summary: {
        job_id: job.id,
        job_name: job.name,
        tasks_imported: @created_tasks.count,
        dependencies_created: @created_dependencies.count,
        errors_count: @errors.count
      }
    }
  end

  def failure(message)
    {
      success: false,
      imported_count: 0,
      errors: Array(message) + @errors
    }
  end
end
