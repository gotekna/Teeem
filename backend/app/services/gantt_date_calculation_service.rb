# frozen_string_literal: true

# GanttDateCalculationService - SSoT for Gantt Date Calculation
#
# Calculates dates from dependencies using topological sort.
# Works with BOTH SmScheduleMaster (templates) and SmTask (jobs).
#
# Same code path, different behavior based on data model:
# - SmScheduleMaster: No start_date/end_date columns, no locked? method → always calculates
# - SmTask: Has start_date/end_date columns, has locked? method → uses stored dates if locked
#
# Usage:
#   # For templates (SmScheduleMaster)
#   date_overrides = GanttDateCalculationService.new(template.sm_schedule_master_rows).calculate_date_map
#
#   # For jobs (SmTask) - identical call
#   date_overrides = GanttDateCalculationService.new(job.sm_tasks).calculate_date_map
#
class GanttDateCalculationService
  def initialize(records)
    @records = records.to_a
  end

  # Returns: Hash of task_number => { start_date: Date, end_date: Date }
  def calculate_date_map
    return {} if @records.empty?

    @start_date = Date.current
    @calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)
    @start_date = @calendar.next_working_day(@start_date) unless @calendar.working_day?(@start_date)

    @rows_by_task = @records.index_by(&:task_number)

    build_hierarchy_maps
    build_dependency_graph
    sorted_tasks = topological_sort
    date_map = calculate_task_dates(sorted_tasks)
    calculate_header_spans(date_map)

    date_map
  end

  private

  # Build parent -> children map and determine header levels
  def build_hierarchy_maps
    @all_children = {}
    @records.each do |row|
      parent_id = extract_header_parent(row.header_gantt)
      if parent_id
        @all_children[parent_id] ||= []
        @all_children[parent_id] << row
      end
    end

    # Determine header levels (1 = has header children, 2 = leaf header)
    @header_level = {}
    @records.select(&:allow_header).each do |header|
      children = @all_children[header.task_number] || []
      has_header_child = children.any?(&:allow_header)
      @header_level[header.task_number] = has_header_child ? 1 : 2
    end

    @tasks = @records.reject(&:allow_header)
    @task_numbers = @tasks.map(&:task_number).to_set
    @header_numbers = @records.select(&:allow_header).map(&:task_number).to_set
  end

  # Build dependency graph with header expansion and inherited predecessors
  def build_dependency_graph
    @all_deps = {}

    @tasks.each do |row|
      deps = (row.predecessor_ids || []).map { |p| p.is_a?(Hash) ? (p['id'] || p[:id]) : p }
      inherited = get_inherited_predecessors(row).map { |p| p.is_a?(Hash) ? (p['id'] || p[:id]) : p }

      expanded_deps = []
      (deps + inherited).map(&:to_i).uniq.each do |dep_id|
        if @header_numbers.include?(dep_id)
          expanded_deps.concat(get_tasks_under_header(dep_id))
        elsif @task_numbers.include?(dep_id)
          expanded_deps << dep_id
        end
      end
      @all_deps[row.task_number] = expanded_deps.uniq
    end
  end

  # Get inherited predecessors by walking up header chain
  def get_inherited_predecessors(row)
    inherited = []
    current_parent_id = extract_header_parent(row.header_gantt)
    while current_parent_id
      parent = @rows_by_task[current_parent_id]
      break unless parent
      inherited.concat(parent.predecessor_ids || [])
      current_parent_id = extract_header_parent(parent.header_gantt)
    end
    inherited
  end

  # Get all tasks under a header recursively
  def get_tasks_under_header(header_task_number)
    result = []
    children = @all_children[header_task_number] || []
    children.each do |child|
      if child.allow_header
        result.concat(get_tasks_under_header(child.task_number))
      else
        result << child.task_number
      end
    end
    result
  end

  # Topological sort - handles forward-referencing predecessors correctly
  def topological_sort
    in_degree = {}
    @tasks.each { |t| in_degree[t.task_number] = 0 }
    dependents = Hash.new { |h, k| h[k] = [] }

    @all_deps.each do |task, deps|
      in_degree[task] = deps.size
      deps.each { |dep| dependents[dep] << task }
    end

    queue = @tasks.select { |t| in_degree[t.task_number] == 0 }
    sorted_tasks = []

    while queue.any?
      task = queue.min_by(&:sequence_order)
      queue.delete(task)
      sorted_tasks << task

      dependents[task.task_number].each do |dependent_task_num|
        in_degree[dependent_task_num] -= 1
        if in_degree[dependent_task_num] == 0
          dependent_task = @tasks.find { |t| t.task_number == dependent_task_num }
          queue << dependent_task if dependent_task
        end
      end
    end

    # Handle cycles - add remaining tasks in sequence order
    if sorted_tasks.size < @tasks.size
      remaining = @tasks - sorted_tasks
      sorted_tasks.concat(remaining.sort_by(&:sequence_order))
    end

    sorted_tasks
  end

  # Calculate dates in topological order (ensures predecessors calculated first)
  def calculate_task_dates(sorted_tasks)
    date_map = {}

    sorted_tasks.each do |task|
      row_start, row_end = calculate_single_task_dates(task, date_map)
      date_map[task.task_number] = { start_date: row_start, end_date: row_end }
    end

    date_map
  end

  # Calculate dates for a single task
  # IDENTICAL CODE PATH FOR BOTH SmScheduleMaster and SmTask:
  # - SmScheduleMaster: doesn't have locked? method → always calculates
  # - SmTask: has locked? method → checks it first
  def calculate_single_task_dates(task, date_map)
    # Check if task is locked (SmTask only - SmScheduleMaster doesn't have this method)
    # Locked tasks keep their stored dates as anchors
    if task.respond_to?(:locked?) && task.locked? && task.start_date.present?
      row_start = task.start_date
      row_end = task.end_date || @calendar.add_working_days(row_start, (task.duration_days || 1) - 1)
      return [row_start, row_end]
    end

    # Started tasks use hold_date as anchor (even if hold is false)
    # This allows "started" checkbox without "hold" checkbox, but task stays pinned
    if task.try(:started) && task.hold_date.present?
      row_start = task.hold_date.to_date
      row_start = @calendar.next_working_day(row_start) unless @calendar.working_day?(row_start)
      duration = task.duration_days || 1
      row_end = @calendar.add_working_days(row_start, duration - 1)
      return [row_start, row_end]
    end

    # Hold with date (both tables have this)
    if task.hold && task.hold_date.present?
      row_start = task.hold_date.to_date
      row_start = @calendar.next_working_day(row_start) unless @calendar.working_day?(row_start)
    else
      # Calculate from predecessors
      all_predecessors = @all_deps[task.task_number] || []
      latest_pred_end = nil

      all_predecessors.each do |pred_id|
        pred_dates = date_map[pred_id]
        next unless pred_dates
        pred_end = pred_dates[:end_date]
        latest_pred_end = pred_end if latest_pred_end.nil? || pred_end > latest_pred_end
      end

      row_start = latest_pred_end ? @calendar.add_working_days(latest_pred_end, 1) : @start_date
      row_start = @calendar.next_working_day(row_start) unless @calendar.working_day?(row_start)
    end

    duration = task.duration_days || 1
    row_end = @calendar.add_working_days(row_start, duration - 1)

    [row_start, row_end]
  end

  # Calculate header spans (bottom-up: Level-2 first, then Level-1)
  def calculate_header_spans(date_map)
    # Level-2 headers first
    @records.select { |r| r.allow_header && @header_level[r.task_number] == 2 }.each do |header|
      calculate_header_dates(header, date_map)
    end

    # Level-1 headers second
    @records.select { |r| r.allow_header && @header_level[r.task_number] == 1 }.each do |header|
      calculate_header_dates(header, date_map)
    end
  end

  def calculate_header_dates(header, date_map)
    children = @all_children[header.task_number] || []
    if children.any?
      child_starts = children.map { |c| date_map[c.task_number]&.dig(:start_date) }.compact
      child_ends = children.map { |c| date_map[c.task_number]&.dig(:end_date) }.compact
      effective_start = child_starts.min || @start_date
      effective_end = child_ends.max || effective_start
      date_map[header.task_number] = { start_date: effective_start, end_date: effective_end }
    else
      duration = header.duration_days || 1
      date_map[header.task_number] = { start_date: @start_date, end_date: @calendar.add_working_days(@start_date, duration - 1) }
    end
  end

  # Extract parent header task_number from header_gantt field
  def extract_header_parent(header_gantt)
    return nil if header_gantt.blank? || header_gantt == 'Header'
    return header_gantt if header_gantt.is_a?(Integer)
    return header_gantt['id'] || header_gantt[:id] if header_gantt.is_a?(Hash)
    header_gantt.to_i if header_gantt.to_s.match?(/^\d+$/)
  end
end
