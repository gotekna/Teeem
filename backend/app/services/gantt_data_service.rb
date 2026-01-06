# frozen_string_literal: true

# GanttDataService - SSoT for Gantt Chart Data
#
# Converts task data to unified Gantt format with proper ID handling.
# All task_number references in predecessor_ids are converted to row.id (database PK).
#
# This is THE SINGLE conversion point - frontend receives ready-to-render data.
#
# Supports 2-level nested headers:
#   Level 1: Stage headers (SLAB, FRAME, etc.) - allow_header=true, no parent
#   Level 2: Group headers (DRIVEWAY, LANDSCAPING) - allow_header=true, parent is a Level 1 header
#   Level 3: Tasks - allow_header=false, parent can be Level 1 or Level 2 header
#
# Usage:
#   # For SmScheduleMaster templates
#   service = GanttDataService.new(template.sm_schedule_masters.ordered)
#   gantt_data = service.build_response
#
#   # For SmTask job tasks (with PO visibility filtering)
#   service = GanttDataService.new(job.sm_tasks.ordered, filter_invisible: true)
#   gantt_data = service.build_response
#
# Response format:
#   {
#     tasks: [{ id: "123", name: "Task", start_date: "2024-01-01", nesting_level: 0|1|2, ... }],
#     dependencies: [{ id: "100-123", fromId: "100", toId: "123", type: "FS", lag: 0 }]
#   }
#
class GanttDataService
  def initialize(records, options = {})
    @records = records
    @options = options
    @filter_invisible = options[:filter_invisible] || false
    # date_overrides: Hash of task_number => { start_date: Date, end_date: Date }
    # Used for templates where dates are calculated from dependencies, not stored
    # SSoT: Calculated by calculate_template_date_map using topological sort
    @date_overrides = options[:date_overrides] || {}
  end

  # Get start_date for a record, checking date_overrides first (for templates)
  def get_start_date(record)
    override = @date_overrides[record.task_number]
    return override[:start_date] if override && override[:start_date]
    record.try(:start_date)
  end

  # Get end_date for a record, checking date_overrides first (for templates)
  def get_end_date(record)
    override = @date_overrides[record.task_number]
    return override[:end_date] if override && override[:end_date]
    record.try(:end_date)
  end

  def build_response
    # Build lookup map: task_number -> row.id
    task_num_to_row_id = build_lookup_map

    # Filter invisible tasks if requested (po_required without PO)
    visible_records, invisible_ids = filter_records

    # SSoT: Sort hierarchically - headers followed by their children
    sorted_records = sort_hierarchically(visible_records)

    # Rewire dependencies around invisible tasks if any were filtered
    dependencies = if invisible_ids.any?
      rewire_dependencies_around_invisible(sorted_records, invisible_ids, task_num_to_row_id)
    else
      build_dependencies(sorted_records, task_num_to_row_id)
    end

    {
      tasks: sorted_records.map { |r| task_to_gantt_format(r) },
      dependencies: dependencies,
      meta: {
        total_count: @records.count,
        visible_count: visible_records.count,
        invisible_count: invisible_ids.size
      }
    }
  end

  private

  # Build lookup: task_number -> row.id
  def build_lookup_map
    @records.each_with_object({}) { |r, h| h[r.task_number] = r.id }
  end

  # Filter out invisible tasks (po_required=true but no PO linked)
  # Returns [visible_records, invisible_ids_set]
  def filter_records
    return [@records, Set.new] unless @filter_invisible

    invisible_ids = Set.new
    visible_records = []

    @records.each do |record|
      po_required = record.po_required || false
      has_po = record.respond_to?(:has_linked_po?) ? record.has_linked_po? : false

      if po_required && !has_po
        invisible_ids.add(record.id)
      else
        visible_records << record
      end
    end

    [visible_records, invisible_ids]
  end

  # Build dependencies array with row.id references
  # SSoT: This is THE ONLY place that converts task_number -> row.id
  def build_dependencies(records, lookup)
    records.flat_map do |record|
      (record.predecessor_ids || []).filter_map do |pred|
        pred_task_num = (pred["id"] || pred[:id]).to_i
        from_id = lookup[pred_task_num]
        next unless from_id  # Skip if predecessor doesn't exist in this set

        {
          id: "#{from_id}-#{record.id}",
          fromId: from_id.to_s,
          toId: record.id.to_s,
          type: pred["type"] || pred[:type] || "FS",
          lag: pred["lag"] || pred[:lag] || 0
        }
      end
    end
  end

  # Rewire dependencies to skip invisible tasks
  # If A -> B -> C and B is invisible, creates A -> C with combined lag
  def rewire_dependencies_around_invisible(visible_records, invisible_ids, lookup)
    return build_dependencies(visible_records, lookup) if invisible_ids.empty?

    # Build adjacency maps from ALL records (including invisible)
    predecessor_map = Hash.new { |h, k| h[k] = [] }
    successor_map = Hash.new { |h, k| h[k] = [] }

    @records.each do |record|
      (record.predecessor_ids || []).each do |pred|
        pred_task_num = (pred["id"] || pred[:id]).to_i
        pred_id = lookup[pred_task_num]
        next unless pred_id

        predecessor_map[record.id] << {
          id: pred_id,
          type: pred["type"] || pred[:type] || "FS",
          lag: pred["lag"] || pred[:lag] || 0
        }
        successor_map[pred_id] << {
          id: record.id,
          type: pred["type"] || pred[:type] || "FS",
          lag: pred["lag"] || pred[:lag] || 0
        }
      end
    end

    # For each visible task, find visible predecessors (traversing through invisible)
    result = []
    visible_id_set = Set.new(visible_records.map(&:id))

    visible_records.each do |record|
      find_visible_predecessors(record.id, predecessor_map, invisible_ids, visible_id_set).each do |pred_info|
        result << {
          id: "#{pred_info[:id]}-#{record.id}",
          fromId: pred_info[:id].to_s,
          toId: record.id.to_s,
          type: pred_info[:type],
          lag: pred_info[:lag]
        }
      end
    end

    result
  end

  # BFS to find visible predecessors through invisible chains
  def find_visible_predecessors(task_id, predecessor_map, invisible_ids, visible_id_set)
    result = []
    queue = predecessor_map[task_id].map { |p| { id: p[:id], type: p[:type], lag: p[:lag] } }
    visited = Set.new

    while queue.any?
      current = queue.shift
      next if visited.include?(current[:id])
      visited.add(current[:id])

      if invisible_ids.include?(current[:id])
        # Traverse through invisible task
        predecessor_map[current[:id]].each do |pred|
          # Combine lags when traversing through invisible
          combined_lag = current[:lag] + pred[:lag]
          queue << { id: pred[:id], type: pred[:type], lag: combined_lag }
        end
      elsif visible_id_set.include?(current[:id])
        # Found visible predecessor
        result << current
      end
    end

    result
  end

  # Convert record to Gantt task format
  def task_to_gantt_format(record)
    {
      id: record.id.to_s,
      task_number: record.task_number,
      name: record.name,
      start_date: format_date(record.try(:start_date) || record.try(:hold_date)),
      end_date: format_date(record.try(:end_date)),
      duration_days: record.duration_days || 1,
      status: record.try(:status) || "not_started",
      progress_percentage: record.try(:progress_percentage) || 0,
      locked: record.try(:confirm) || false,
      supplier_confirm: record.try(:supplier_confirm) || false,
      hold: record.try(:hold) || false,
      hold_date: format_date(record.try(:hold_date)),
      is_completed: record.try(:is_completed) || false,
      completed_at: format_date(record.try(:completed_at)),
      dependency_broken: record.try(:dependency_broken) || false,
      # Include predecessor_ids for frontend display (task_number format)
      predecessor_ids: record.predecessor_ids || [],
      # PO-related fields
      po_required: record.po_required || false,
      supplier_id: record.try(:supplier_id) || record.try(:po_supplier_id),
      supplier_name: record.try(:supplier)&.name || record.try(:po_supplier)&.name,
      purchase_order_id: record.respond_to?(:linked_purchase_order) ? record.linked_purchase_order&.id : nil,
      # Header/parent info - now supports 2-level nesting
      header_gantt: determine_header_gantt(record),
      # SSoT: Explicit allow_header flag for canvas renderer header detection
      allow_header: is_header?(record),
      parent_id: record.try(:parent_task_id),
      # Nesting level for 2-level hierarchy (0=Level1 header, 1=Level2 header/child of L1, 2=child of L2)
      nesting_level: calculate_nesting_level(record, @header_task_numbers || Set.new, @header_by_task_number || {}),
      # Ordering
      sequence_order: record.try(:sequence_order) || 0,
      # Additional fields
      trade: record.try(:trade),
      stage: record.try(:stage),
      assigned_role: record.try(:assigned_role),
      color: record.try(:color)
    }.compact
  end

  def format_date(date)
    return nil unless date
    date.respond_to?(:strftime) ? date.strftime("%Y-%m-%d") : date.to_s
  end

  # SSoT: Sort hierarchically with 2-level nesting support
  # Structure: Level 1 Header → Level 2 Header (optional) → Tasks
  # ALL rows sorted by start_date for intuitive Gantt display
  # Headers appear at the position of their earliest child
  def sort_hierarchically(records)
    return records if records.empty?

    # Build maps for headers and their relationships
    header_task_numbers = Set.new
    header_by_task_number = {}
    children_by_parent = Hash.new { |h, k| h[k] = [] }

    # First pass: identify all headers
    records.each do |r|
      if is_header?(r)
        header_task_numbers.add(r.task_number)
        header_by_task_number[r.task_number] = r
      end
    end

    # Second pass: group all records by their parent
    # This now includes Level 2 headers under Level 1 headers
    records.each do |r|
      parent_num = get_parent_task_number(r)
      if parent_num && header_task_numbers.include?(parent_num)
        children_by_parent[parent_num] << r
      end
    end

    # Identify Level 1 headers (no parent) vs Level 2 headers (have parent)
    level1_headers = []
    level2_headers = []

    header_by_task_number.each do |_task_num, header|
      parent_num = get_parent_task_number(header)
      if parent_num.nil?
        level1_headers << header
      else
        level2_headers << header
      end
    end

    # Sort children within each parent by start_date, then end_date, then sequence_order
    children_by_parent.each_value do |children|
      children.sort_by! { |c| [get_start_date(c) || Date.new(9999), get_end_date(c) || Date.new(9999), c.try(:sequence_order) || 0] }
    end

    # Calculate effective start dates for all headers (recursive)
    header_start_dates = {}

    # First, calculate start dates for Level 2 headers (from their task children)
    level2_headers.each do |header|
      children = children_by_parent[header.task_number].reject { |c| is_header?(c) }
      if children.any?
        header_start_dates[header.task_number] = children.map { |c| get_start_date(c) || Date.new(9999) }.min
      else
        header_start_dates[header.task_number] = get_start_date(header) || Date.new(9999)
      end
    end

    # Then, calculate start dates for Level 1 headers (from Level 2 headers + direct task children)
    level1_headers.each do |header|
      all_children = children_by_parent[header.task_number]
      child_dates = all_children.map do |child|
        if is_header?(child)
          header_start_dates[child.task_number] || get_start_date(child) || Date.new(9999)
        else
          get_start_date(child) || Date.new(9999)
        end
      end

      if child_dates.any?
        header_start_dates[header.task_number] = child_dates.min
      else
        header_start_dates[header.task_number] = get_start_date(header) || Date.new(9999)
      end
    end

    # Calculate effective end dates for all headers (recursive) - using MAX instead of MIN
    header_end_dates = {}

    # First, calculate end dates for Level 2 headers (from their task children)
    level2_headers.each do |header|
      children = children_by_parent[header.task_number].reject { |c| is_header?(c) }
      if children.any?
        header_end_dates[header.task_number] = children.map { |c| get_end_date(c) || Date.new(0) }.max
      else
        header_end_dates[header.task_number] = get_end_date(header) || Date.new(9999)
      end
    end

    # Then, calculate end dates for Level 1 headers (from Level 2 headers + direct task children)
    level1_headers.each do |header|
      all_children = children_by_parent[header.task_number]
      child_end_dates = all_children.map do |child|
        if is_header?(child)
          header_end_dates[child.task_number] || get_end_date(child) || Date.new(0)
        else
          get_end_date(child) || Date.new(0)
        end
      end

      if child_end_dates.any?
        header_end_dates[header.task_number] = child_end_dates.max
      else
        header_end_dates[header.task_number] = get_end_date(header) || Date.new(9999)
      end
    end

    # Collect standalone/orphaned tasks (no parent, not a header)
    standalone_tasks = records.reject do |r|
      is_header?(r) || (get_parent_task_number(r) && header_task_numbers.include?(get_parent_task_number(r)))
    end

    # Build sortable blocks
    # Each Level 1 header is a block containing: header, then nested structure
    blocks = []

    # Add Level 1 header blocks with nested content
    level1_headers.each do |l1_header|
      block_items = [l1_header]

      # Get all children of this Level 1 header
      l1_children = children_by_parent[l1_header.task_number]

      # Sort children: by start_date, then end_date, then sequence_order
      l1_children.sort_by! { |c| [get_start_date(c) || Date.new(9999), get_end_date(c) || Date.new(9999), c.try(:sequence_order) || 0] }

      l1_children.each do |child|
        if is_header?(child)
          # This is a Level 2 header - add it and its children
          block_items << child
          l2_children = children_by_parent[child.task_number]
          l2_children.sort_by! { |c| [get_start_date(c) || Date.new(9999), get_end_date(c) || Date.new(9999), c.try(:sequence_order) || 0] }
          block_items.concat(l2_children)
        else
          # Direct task child of Level 1 header
          block_items << child
        end
      end

      blocks << {
        start_date: header_start_dates[l1_header.task_number],
        end_date: header_end_dates[l1_header.task_number],
        sequence_order: l1_header.try(:sequence_order) || 0,
        items: block_items
      }
    end

    # Add standalone task blocks
    standalone_tasks.each do |task|
      blocks << {
        start_date: get_start_date(task) || Date.new(9999),
        end_date: get_end_date(task) || Date.new(9999),
        sequence_order: task.try(:sequence_order) || 0,
        items: [task]
      }
    end

    # Sort all blocks by start_date, then end_date, then sequence_order as tiebreaker
    blocks.sort_by! { |b| [b[:start_date], b[:end_date], b[:sequence_order]] }

    # Store header maps for nesting_level calculation
    @header_task_numbers = header_task_numbers
    @header_by_task_number = header_by_task_number

    # Flatten blocks into result
    blocks.flat_map { |b| b[:items] }
  end

  # Check if record is a header
  def is_header?(record)
    record.try(:allow_header) || record.try(:sm_schedule_master)&.allow_header
  end

  # Get parent task_number from header_gantt field
  # Now supports nested headers - headers CAN have parents (2-level nesting)
  def get_parent_task_number(record)
    header_gantt = record.try(:header_gantt) || record.try(:sm_schedule_master)&.header_gantt
    return nil if header_gantt.nil? || header_gantt == "Header"

    # Parse task_number from header_gantt (can be string or integer)
    header_gantt.to_i if header_gantt.to_s.match?(/^\d+$/)
  end

  # SSoT: Determine header_gantt value for frontend
  # For 2-level nesting:
  #   - Level 1 headers (no parent): returns "Header"
  #   - Level 2 headers (has parent): returns parent task_number (they ARE headers but HAVE a parent)
  #   - Tasks: returns parent task_number
  # Returns nil if no parent
  def determine_header_gantt(record)
    header_gantt = record.try(:header_gantt) || record.try(:sm_schedule_master)&.header_gantt
    is_header = record.try(:allow_header) || record.try(:sm_schedule_master)&.allow_header

    # If header_gantt has a numeric parent, return it (even for Level 2 headers)
    if header_gantt.present? && header_gantt != "Header" && header_gantt.to_s.match?(/^\d+$/)
      return header_gantt
    end

    # Level 1 header (no parent) - return "Header"
    if is_header
      "Header"
    else
      # Regular task with no parent
      nil
    end
  end

  # Calculate nesting level for a record
  # Level 0: Top-level headers (allow_header=true, no parent)
  # Level 1: Sub-headers or direct children of Level 0 headers
  # Level 2: Children of Level 1 headers (tasks under sub-headers)
  def calculate_nesting_level(record, header_task_numbers, header_by_task_number)
    parent_num = get_parent_task_number(record)
    is_header = is_header?(record)

    if is_header && parent_num.nil?
      # Level 1 header (top-level)
      0
    elsif is_header && parent_num.present?
      # Level 2 header (sub-header under a Level 1 header)
      1
    elsif parent_num.present?
      # Task with a parent - check if parent is Level 1 or Level 2
      parent_header = header_by_task_number[parent_num]
      if parent_header
        parent_parent_num = get_parent_task_number(parent_header)
        if parent_parent_num.nil?
          # Parent is Level 1 header, so this task is Level 1
          1
        else
          # Parent is Level 2 header, so this task is Level 2
          2
        end
      else
        1 # Default to Level 1 if parent not found
      end
    else
      # Orphan task (no parent)
      0
    end
  end
end
