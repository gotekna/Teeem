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
    # filter_invisible (jobs): filter by has_linked_po? - task requires PO but no PO created
    @filter_invisible = options[:filter_invisible] || false
    # filter_po_tasks (templates): filter by po_supplier_id.blank? - task requires PO but no supplier configured
    @filter_po_tasks = options[:filter_po_tasks] || false
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
    # Build lookup map: task_number -> row.id from ALL records
    # This ensures dependencies can reference any task, even filtered ones
    task_num_to_row_id = build_lookup_map

    # SSoT: Expand header dependencies to task dependencies BEFORE filtering
    # This ensures inherited deps are calculated from the complete dependency graph
    @inherited_deps = expand_header_dependencies(@records)

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

  # Filter out invisible tasks based on mode:
  # - filter_invisible (jobs): po_required=true but no PO linked (has_linked_po?)
  # - filter_po_tasks (templates): po_required=true but no supplier configured (po_supplier_id.blank?)
  # Returns [visible_records, invisible_ids_set]
  def filter_records
    return [@records, Set.new] unless @filter_invisible || @filter_po_tasks

    invisible_ids = Set.new
    visible_records = []

    @records.each do |record|
      po_required = record.po_required || false
      should_hide = false

      if po_required
        if @filter_po_tasks
          # Template mode: hide if no supplier configured
          should_hide = record.respond_to?(:po_supplier_id) && record.po_supplier_id.blank?
        elsif @filter_invisible
          # Job mode: hide if no PO linked
          has_po = record.respond_to?(:has_linked_po?) ? record.has_linked_po? : false
          should_hide = !has_po
        end
      end

      if should_hide
        invisible_ids.add(record.id)
      else
        visible_records << record
      end
    end

    [visible_records, invisible_ids]
  end

  # SSoT: Expand header dependencies to task dependencies
  # When a header depends on another header, all tasks under the first header
  # inherit ALL tasks under the second header as predecessors.
  #
  # Supports 2-level nesting:
  # - Level 1 header can depend on Level 1 header
  # - Level 2 sub-header can depend on Level 2 sub-header or Level 1 header
  # - Tasks inherit from their parent header AND grandparent header
  #
  # Returns: Hash of record.id => [inherited_predecessor_task_numbers]
  def expand_header_dependencies(records)
    headers = records.select { |r| is_header?(r) }
    header_by_task_num = headers.index_by(&:task_number)

    # Build parent→children map
    children_by_parent = Hash.new { |h, k| h[k] = [] }
    records.each { |r| children_by_parent[get_parent_task_number(r)] << r }

    # Helper: Get ALL tasks under a header (recursively into sub-headers)
    get_all_tasks_under = lambda do |header_task_num|
      result = []
      children_by_parent[header_task_num].each do |child|
        if is_header?(child)
          # Sub-header: recurse into it
          result.concat(get_all_tasks_under.call(child.task_number))
        else
          # Task: add it
          result << child.task_number
        end
      end
      result
    end

    inherited_deps = {}

    records.each do |record|
      next if is_header?(record)

      inherited = []

      # Walk up the header chain (task → sub-header → header)
      current_parent = get_parent_task_number(record)
      while current_parent
        parent_header = header_by_task_num[current_parent]
        break unless parent_header

        # Get this header's dependencies on other headers
        (parent_header.predecessor_ids || []).each do |pred|
          pred_task_num = (pred["id"] || pred[:id]).to_i
          pred_header = header_by_task_num[pred_task_num]
          next unless pred_header

          # Inherit ALL tasks under the predecessor header (recursive)
          inherited.concat(get_all_tasks_under.call(pred_task_num))
        end

        # Move up to parent's parent (for sub-header → header chain)
        current_parent = get_parent_task_number(parent_header)
      end

      inherited_deps[record.id] = inherited.uniq if inherited.any?
    end

    inherited_deps
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
  # SSoT: Uses calculated dates from @date_overrides (topological sort) for templates
  def task_to_gantt_format(record)
    # Get calculated dates from date_overrides (for templates) or use stored dates (for jobs)
    calculated_start = get_start_date(record)
    calculated_end = get_end_date(record)

    {
      id: record.id.to_s,
      task_number: record.task_number,
      name: record.name,
      start_date: format_date(calculated_start || record.try(:hold_date)),
      end_date: format_date(calculated_end),
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
      # SSoT: Inherited predecessors from header dependencies (calculated by backend)
      # Frontend reads this, does NOT calculate - single source of truth
      inherited_predecessor_ids: @inherited_deps&.dig(record.id) || [],
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
  #
  # ARCHITECTURE:
  # - Headers are sorted by their EFFECTIVE dates (span of children)
  # - Effective start = min(children.start_date), Effective end = max(children.end_date)
  # - Sort rule: [start_date, end_date (earliest first), sequence_order]
  # - Children remain grouped under their parent headers
  def sort_hierarchically(records)
    return records if records.empty?

    # PHASE 1: Build hierarchy maps
    header_task_numbers = Set.new
    header_by_task_number = {}
    children_by_parent = Hash.new { |h, k| h[k] = [] }

    records.each do |r|
      if is_header?(r)
        header_task_numbers.add(r.task_number)
        header_by_task_number[r.task_number] = r
      end
    end

    records.each do |r|
      parent_num = get_parent_task_number(r)
      if parent_num && header_task_numbers.include?(parent_num)
        children_by_parent[parent_num] << r
      end
    end

    # Store for nesting_level calculation
    @header_task_numbers = header_task_numbers
    @header_by_task_number = header_by_task_number

    # PHASE 2: Calculate effective dates for headers
    # Effective dates = span of ALL descendants (including through sub-headers)
    header_effective_dates = {}

    # Helper to get all descendant tasks recursively
    get_all_descendant_tasks = lambda do |header_task_num|
      result = []
      children_by_parent[header_task_num].each do |child|
        if is_header?(child)
          # Sub-header: recurse into it
          result.concat(get_all_descendant_tasks.call(child.task_number))
        else
          # Task: add it
          result << child
        end
      end
      result
    end

    header_by_task_number.each do |task_num, header|
      descendants = get_all_descendant_tasks.call(task_num)
      if descendants.any?
        start_dates = descendants.map { |t| get_start_date(t) }.compact
        end_dates = descendants.map { |t| get_end_date(t) }.compact
        header_effective_dates[task_num] = {
          start_date: start_dates.min,
          end_date: end_dates.max
        }
      else
        # Orphan header - use Date.new(9999) to sort at end
        header_effective_dates[task_num] = {
          start_date: Date.new(9999),
          end_date: Date.new(9999)
        }
      end
    end

    # PHASE 3: Sort key - [start_date, end_date, sequence_order]
    # For headers: use effective dates (span of children)
    # For tasks: use their own dates
    sort_key = lambda do |r|
      if is_header?(r)
        effective = header_effective_dates[r.task_number] || {}
        [effective[:start_date] || Date.new(9999),
         effective[:end_date] || Date.new(9999),
         r.try(:sequence_order) || 0]
      else
        [get_start_date(r) || Date.new(9999),
         get_end_date(r) || Date.new(9999),
         r.try(:sequence_order) || 0]
      end
    end

    # PHASE 4: Identify top-level items (Level 1 headers + orphan tasks)
    # Tasks with parents will be grouped under their headers
    level1_headers = header_by_task_number.values.select { |h| get_parent_task_number(h).nil? }
    orphan_tasks = records.reject { |r| is_header?(r) || get_parent_task_number(r) }

    # Sort Level 1 headers and orphan tasks together
    top_level_items = (level1_headers + orphan_tasks).sort_by(&sort_key)

    # PHASE 5: Build result with children grouped under headers
    result = []

    # Helper to recursively add header and all its children (sorted)
    add_header_with_children = lambda do |header|
      result << header
      # Get direct children (could be sub-headers or tasks)
      direct_children = children_by_parent[header.task_number]
      # Sort children by their effective dates
      sorted_children = direct_children.sort_by(&sort_key)

      sorted_children.each do |child|
        if is_header?(child)
          # Sub-header: recurse
          add_header_with_children.call(child)
        else
          # Task: add directly
          result << child
        end
      end
    end

    top_level_items.each do |item|
      if is_header?(item)
        add_header_with_children.call(item)
      else
        # Orphan task
        result << item
      end
    end

    result
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
