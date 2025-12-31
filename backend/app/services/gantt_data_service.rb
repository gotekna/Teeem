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

    # Rewire dependencies around invisible tasks if any were filtered
    dependencies = if invisible_ids.any?
      rewire_dependencies_around_invisible(visible_records, invisible_ids, task_num_to_row_id)
    else
      build_dependencies(visible_records, task_num_to_row_id)
    end

    {
      tasks: visible_records.map { |r| task_to_gantt_format(r) },
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
      header_gantt: record.try(:header_gantt),
      parent_id: record.try(:parent_task_id),
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
end
