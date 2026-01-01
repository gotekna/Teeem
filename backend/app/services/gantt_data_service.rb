# frozen_string_literal: true

# GanttDataService - SSoT for Gantt Chart Data
#
# Converts task data to unified Gantt format with proper ID handling.
# All task_number references in predecessor_ids are converted to row.id (database PK).
#
# This is THE SINGLE conversion point - frontend receives ready-to-render data.
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
#     tasks: [{ id: "123", name: "Task", start_date: "2024-01-01", ... }],
#     dependencies: [{ id: "100-123", fromId: "100", toId: "123", type: "FS", lag: 0 }]
#   }
#
class GanttDataService
  def initialize(records, options = {})
    @records = records
    @options = options
    @filter_invisible = options[:filter_invisible] || false
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
      # Header/parent info
      # SSoT: allow_header = true means this IS a header → return "Header"
      # Otherwise, return the parent's task_number from header_gantt column
      # SmTask doesn't have header_gantt column - look it up from linked sm_schedule_master
      header_gantt: determine_header_gantt(record),
      parent_id: record.try(:parent_task_id),
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

  # SSoT: Sort records hierarchically - headers followed by their children
  # ALL rows sorted by start_date for intuitive Gantt display
  # Headers appear at the position of their earliest child
  def sort_hierarchically(records)
    return records if records.empty?

    # Identify headers and build parent map
    header_task_numbers = Set.new
    children_by_parent = Hash.new { |h, k| h[k] = [] }
    header_by_task_number = {}

    records.each do |r|
      if is_header?(r)
        header_task_numbers.add(r.task_number)
        header_by_task_number[r.task_number] = r
      end
    end

    # Group children by their parent's task_number
    records.each do |r|
      parent_num = get_parent_task_number(r)
      if parent_num && header_task_numbers.include?(parent_num)
        children_by_parent[parent_num] << r
      end
    end

    # Sort children within each header by start_date
    children_by_parent.each_value do |children|
      children.sort_by! { |c| [c.try(:start_date) || Date.new(9999), c.try(:sequence_order) || 0] }
    end

    # Calculate effective start date for headers (min of children's start dates)
    header_start_dates = {}
    header_by_task_number.each do |task_num, header|
      children = children_by_parent[task_num]
      if children.any?
        header_start_dates[task_num] = children.map { |c| c.try(:start_date) || Date.new(9999) }.min
      else
        header_start_dates[task_num] = header.try(:start_date) || Date.new(9999)
      end
    end

    # Collect standalone/orphaned tasks
    standalone_tasks = records.reject do |r|
      is_header?(r) || (get_parent_task_number(r) && header_task_numbers.include?(get_parent_task_number(r)))
    end

    # Build sortable blocks: each header with children is a block, each standalone is a block
    blocks = []

    # Add header blocks
    header_by_task_number.each do |task_num, header|
      blocks << {
        start_date: header_start_dates[task_num],
        sequence_order: header.try(:sequence_order) || 0,
        items: [header] + children_by_parent[task_num]
      }
    end

    # Add standalone blocks
    standalone_tasks.each do |task|
      blocks << {
        start_date: task.try(:start_date) || Date.new(9999),
        sequence_order: task.try(:sequence_order) || 0,
        items: [task]
      }
    end

    # Sort all blocks by start_date, then sequence_order as tiebreaker
    blocks.sort_by! { |b| [b[:start_date], b[:sequence_order]] }

    # Flatten blocks into result
    blocks.flat_map { |b| b[:items] }
  end

  # Check if record is a header
  def is_header?(record)
    record.try(:allow_header) || record.try(:sm_schedule_master)&.allow_header
  end

  # Get parent task_number from header_gantt field
  def get_parent_task_number(record)
    return nil if is_header?(record)

    header_gantt = record.try(:header_gantt) || record.try(:sm_schedule_master)&.header_gantt
    return nil if header_gantt.nil? || header_gantt == "Header"

    # Parse task_number from header_gantt (can be string or integer)
    header_gantt.to_i if header_gantt.to_s.match?(/^\d+$/)
  end

  # SSoT: Determine header_gantt value for frontend
  # Returns "Header" if this row IS a header (allow_header = true)
  # Returns parent task_number if this row has a parent header
  # Returns nil otherwise
  def determine_header_gantt(record)
    # Check allow_header on record itself or linked sm_schedule_master
    is_header = record.try(:allow_header) || record.try(:sm_schedule_master)&.allow_header

    if is_header
      "Header"
    else
      # Return parent task_number from header_gantt column
      record.try(:header_gantt) || record.try(:sm_schedule_master)&.header_gantt
    end
  end
end
