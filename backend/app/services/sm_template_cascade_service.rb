# frozen_string_literal: true

# SmTemplateCascadeService - Cascade engine for SM Template rows
#
# Handles dependency propagation when template rows are moved/resized.
# For TEMPLATES, we always cascade - manually_positioned is just for display/undo.
# (Unlike SmCascadeService for jobs which respects supplier_confirm, etc.)
#
# Usage:
#   service = SmTemplateCascadeService.new(row, template)
#   result = service.cascade_successors
#
#   # Or recalculate entire template:
#   SmTemplateCascadeService.recalculate_all(template)
#
class SmTemplateCascadeService
  # Recalculate ALL rows in a template in dependency order
  # This fixes data where offsets haven't been properly cascaded
  def self.recalculate_all(template)
    all_rows = template.sm_template_rows.active.to_a
    rows_by_task_number = all_rows.index_by(&:task_number)

    # Build dependency graph to find processing order
    # Process rows with no predecessors first, then their successors
    processed = Set.new
    updated = []

    # Rows without dependencies start at their current offset (or 0)
    roots = all_rows.select { |r| r.predecessor_ids.blank? }

    queue = roots.dup
    while queue.any?
      row = queue.shift
      next if processed.include?(row.id)

      # Check if all predecessors are processed
      pred_ids = (row.predecessor_ids || []).map { |p| p["id"] || p[:id] }
      pred_rows = pred_ids.map { |id| rows_by_task_number[id] }.compact
      unless pred_rows.all? { |pr| processed.include?(pr.id) }
        queue.push(row) # Re-queue, predecessors not ready
        next
      end

      # Calculate this row's start based on predecessors
      if pred_rows.any?
        service = new(row, template)
        new_offset = service.send(:calculate_start_offset, row)
        if new_offset != row.start_day_offset
          Rails.logger.info "[SmTemplateCascade] Recalculate: #{row.name} offset #{row.start_day_offset} → #{new_offset}"
          row.update!(start_day_offset: new_offset)
          updated << row
        end
      end

      processed.add(row.id)

      # Add successors to queue
      successors = all_rows.select do |r|
        next false if r.predecessor_ids.blank?
        r.predecessor_ids.any? { |p| (p["id"] || p[:id]) == row.task_number }
      end
      queue.concat(successors)
    end

    Rails.logger.info "[SmTemplateCascade] Recalculated #{updated.length} rows"
    updated
  end
  attr_reader :row, :template, :all_rows

  def initialize(row, template)
    @row = row
    @template = template
    @all_rows = template.sm_template_rows.active.to_a
    @rows_by_task_number = @all_rows.index_by(&:task_number)
  end

  # Cascade all dependent rows after the source row was updated
  # Returns array of all updated rows (including the source)
  def cascade_successors
    updated_rows = [row]
    rows_to_process = find_direct_successors(row)

    Rails.logger.info "[SmTemplateCascade] Starting cascade from row #{row.id} (task_number: #{row.task_number})"
    Rails.logger.info "[SmTemplateCascade] Found #{rows_to_process.count} direct successors"

    while rows_to_process.any?
      successor = rows_to_process.shift

      # Skip if already processed
      next if updated_rows.include?(successor)

      # CRITICAL: Skip LOCKED tasks - they NEVER move based on predecessor changes
      # Lock types: Confirmed, Supplier Confirmed, Finance Approved, Completed
      is_locked = successor.require_supervisor_check ||
                  successor.require_supplier_confirm ||
                  successor.try(:finance_approved) ||
                  successor.is_completed

      if is_locked
        Rails.logger.info "[SmTemplateCascade] SKIPPING locked successor #{successor.id} (task_number: #{successor.task_number})"
        # Don't cascade through locked tasks - the chain stops here
        next
      end

      # Recalculate successor's start_day_offset based on its predecessors
      new_offset = calculate_start_offset(successor)
      old_offset = successor.start_day_offset || 0

      if new_offset != old_offset || successor.manually_positioned?
        Rails.logger.info "[SmTemplateCascade] Updating successor #{successor.id}: start_day_offset #{old_offset} → #{new_offset}"

        update_attrs = { start_day_offset: new_offset }

        # Clear manually_positioned if it was set
        if successor.manually_positioned?
          update_attrs[:manually_positioned] = false
          update_attrs[:previous_manual_start_date] = successor.manual_start_date
          update_attrs[:manual_start_date] = nil
        end

        successor.update!(update_attrs)
        updated_rows << successor
      end

      # Add this task's successors to the queue (they may also need clearing)
      rows_to_process.concat(find_direct_successors(successor))
    end

    Rails.logger.info "[SmTemplateCascade] Cascade complete. Updated #{updated_rows.count} rows total"
    updated_rows.uniq
  end

  private

  # Find all rows that have this row as a predecessor
  def find_direct_successors(source_row)
    source_task_number = source_row.task_number

    @all_rows.select do |r|
      next false if r.predecessor_ids.blank?

      r.predecessor_ids.any? do |pred|
        pred_id = pred["id"] || pred[:id]
        pred_id == source_task_number
      end
    end
  end

  # Calculate the start_day_offset based on all predecessors
  def calculate_start_offset(successor)
    return successor.start_day_offset if successor.predecessor_ids.blank?

    # Find the latest end point from all predecessors
    latest_start = successor.predecessor_ids.map do |pred|
      pred_id = pred["id"] || pred[:id]
      pred_type = pred["type"] || pred[:type] || "FS"
      pred_lag = (pred["lag"] || pred[:lag] || 0).to_i

      predecessor = @rows_by_task_number[pred_id]
      next 0 unless predecessor

      pred_start = predecessor.start_day_offset || 0

      # For Headers, calculate effective end from children (not the header row's own duration)
      pred_end = calculate_effective_end(predecessor)

      case pred_type
      when "FS" # Finish-to-Start (most common)
        pred_end + pred_lag
      when "SS" # Start-to-Start
        pred_start + pred_lag
      when "FF" # Finish-to-Finish
        # Successor finishes when predecessor finishes + lag
        # So successor starts at: pred_end + lag - successor_duration
        pred_end + pred_lag - (calculate_effective_duration(successor))
      when "SF" # Start-to-Finish (rare)
        pred_start + pred_lag - (calculate_effective_duration(successor))
      else
        pred_end
      end
    end.compact.max

    # Ensure non-negative
    [latest_start || 0, 0].max
  end

  # Calculate effective end offset (for Headers: max end of all children)
  def calculate_effective_end(row)
    start_offset = row.start_day_offset || 0

    # If it's a Header, find the latest end among all children
    if row.category == 'Header'
      children = @all_rows.select { |r| r.parent_row_id == row.id }
      if children.any?
        # Calculate each child's effective end
        # If child offset < header offset, treat child offset as RELATIVE to header
        max_child_end = children.map do |c|
          child_offset = c.start_day_offset || 0
          child_duration = c.duration_days || 1

          # If child offset seems to be relative (less than header start), add header offset
          effective_child_start = child_offset < start_offset ? start_offset + child_offset : child_offset
          effective_child_start + child_duration
        end.max

        # Ensure header end is at least header_start + 1
        return [max_child_end, start_offset + 1].max
      end
    end

    # Regular task: start + duration
    start_offset + (row.duration_days || 1)
  end

  # Calculate effective duration (for Headers: span of children)
  def calculate_effective_duration(row)
    start_offset = row.start_day_offset || 0

    if row.category == 'Header'
      children = @all_rows.select { |r| r.parent_row_id == row.id }
      if children.any?
        # Handle relative vs absolute child offsets
        effective_ends = children.map do |c|
          child_offset = c.start_day_offset || 0
          child_duration = c.duration_days || 1
          effective_start = child_offset < start_offset ? start_offset + child_offset : child_offset
          effective_start + child_duration
        end
        max_end = effective_ends.max
        return [max_end - start_offset, 1].max
      end
    end

    row.duration_days || 1
  end
end
