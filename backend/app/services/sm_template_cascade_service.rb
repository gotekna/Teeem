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
class SmTemplateCascadeService
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

      # For unlocked successors: Clear manually_positioned so frontend recalculates from predecessors
      # Store the old date in a backup field for undo capability
      if successor.manually_positioned?
        Rails.logger.info "[SmTemplateCascade] Clearing manually_positioned on successor #{successor.id}"
        # Save the old date for potential undo/restore
        successor.update!(
          manually_positioned: false,
          previous_manual_start_date: successor.manual_start_date,
          manual_start_date: nil
        )
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
      pred_duration = predecessor.duration_days || 1
      pred_end = pred_start + pred_duration

      case pred_type
      when "FS" # Finish-to-Start (most common)
        pred_end + pred_lag
      when "SS" # Start-to-Start
        pred_start + pred_lag
      when "FF" # Finish-to-Finish
        # Successor finishes when predecessor finishes + lag
        # So successor starts at: pred_end + lag - successor_duration
        pred_end + pred_lag - (successor.duration_days || 1)
      when "SF" # Start-to-Finish (rare)
        pred_start + pred_lag - (successor.duration_days || 1)
      else
        pred_end
      end
    end.compact.max

    # Ensure non-negative
    [latest_start || 0, 0].max
  end
end
