# frozen_string_literal: true

# PoScheduleSyncService - Sync Purchase Order dates from Schedule Master tasks
#
# SSoT: Schedule Master (SmTask) is the source of truth for dates.
# Direction: Task → PO (safe - no cascade storms)
#
# Usage:
#   service = PoScheduleSyncService.new(purchase_order)
#   preview = service.preview   # See what would change
#   result = service.execute!   # Apply the sync
#
class PoScheduleSyncService
  attr_reader :purchase_order, :linked_tasks

  def initialize(purchase_order)
    @purchase_order = purchase_order
    @linked_tasks = find_linked_tasks
  end

  # Preview the sync without making changes
  # Returns full comparison data for the UI
  def preview
    {
      po: po_state,
      linked_tasks: task_states,
      sync_available: can_sync?,
      blockers: find_blockers,
      sync_preview: build_sync_preview,
      summary: build_summary
    }
  end

  # Execute the sync - updates PO from linked task(s)
  # Only updates if sync is available (no blockers)
  def execute!
    raise SyncBlockedError, "Sync is blocked: #{find_blockers.map { |b| b[:message] }.join(', ')}" unless can_sync?
    raise NoLinkedTasksError, "No linked tasks to sync from" if linked_tasks.empty?

    # Get the primary task (first linked task with a start_date)
    primary_task = linked_tasks.find { |t| t.start_date.present? }
    raise NoSyncableTaskError, "No tasks with start dates to sync from" unless primary_task

    changes = {}

    # Sync required_date from task start_date
    if purchase_order.required_date != primary_task.start_date
      changes[:required_date] = {
        from: purchase_order.required_date,
        to: primary_task.start_date
      }
      purchase_order.required_date = primary_task.start_date
    end

    # Sync supplier if different (should already match via One Entity, but verify)
    if primary_task.supplier_id.present? && purchase_order.supplier_id != primary_task.supplier_id
      changes[:supplier_id] = {
        from: purchase_order.supplier_id,
        to: primary_task.supplier_id
      }
      purchase_order.supplier_id = primary_task.supplier_id
    end

    if changes.any?
      purchase_order.save!
      Rails.logger.info "[PO-Schedule Sync] Synced PO #{purchase_order.purchase_order_number} from task '#{primary_task.name}': #{changes.inspect}"
    end

    {
      success: true,
      synced_from_task: {
        id: primary_task.id,
        name: primary_task.name,
        task_number: primary_task.task_number
      },
      changes: changes,
      message: changes.any? ? "Synced #{changes.keys.join(', ')} from Schedule Master" : "Already in sync"
    }
  end

  # Custom errors
  class SyncBlockedError < StandardError; end
  class NoLinkedTasksError < StandardError; end
  class NoSyncableTaskError < StandardError; end

  private

  # Find all tasks linked to this PO
  # SSoT: SmTask.purchase_order_id is THE ONE link between PO and task
  def find_linked_tasks
    purchase_order.sm_tasks.includes(:predecessors, :supplier).to_a
  end

  # Current PO state for comparison
  def po_state
    {
      id: purchase_order.id,
      purchase_order_number: purchase_order.purchase_order_number,
      required_date: purchase_order.required_date,
      effective_required_date: purchase_order.effective_required_date,
      supplier_id: purchase_order.supplier_id,
      supplier_name: purchase_order.supplier&.display_name,
      status: purchase_order.status
    }
  end

  # State of each linked task
  def task_states
    linked_tasks.map do |task|
      {
        id: task.id,
        task_number: task.task_number,
        name: task.name,
        start_date: task.start_date,
        end_date: task.end_date,
        duration_days: task.duration_days,
        status: task.status,
        trade: task.trade,
        stage: task.stage,
        supplier_id: task.supplier_id,
        supplier_name: task.supplier&.display_name,

        # Lock state
        locked: task.locked?,
        lock_type: task.lock_type,
        confirm: task.confirm?,
        supplier_confirm: task.supplier_confirm?,
        manually_positioned: task.manually_positioned?,

        # Blocker info
        is_blocker: task_is_blocker?(task),
        blocker_reason: task_blocker_reason(task),

        # Dependencies (for context)
        predecessor_count: task.active_predecessor_dependencies.count,
        predecessors: task.predecessors.limit(5).map do |pred|
          {
            id: pred.id,
            name: pred.name,
            end_date: pred.end_date,
            status: pred.status
          }
        end,

        # Date comparison
        date_matches: task.start_date == purchase_order.required_date,
        date_diff_days: calculate_date_diff(task),
        supplier_matches: task.supplier_id == purchase_order.supplier_id
      }
    end
  end

  # Check if a task would block sync (informational - we still show it)
  def task_is_blocker?(task)
    task.status_started? || task.status_completed? || task.supplier_confirm?
  end

  # Human-readable blocker reason
  def task_blocker_reason(task)
    return "Task already completed - date is final" if task.status_completed?
    return "Task already started - date is final" if task.status_started?
    return "Supplier has confirmed this date" if task.supplier_confirm?
    return "Task is confirmed" if task.confirm?
    nil
  end

  # Find all blockers preventing sync
  def find_blockers
    blockers = []

    if linked_tasks.empty?
      blockers << {
        type: :no_linked_tasks,
        message: "No Schedule Master tasks linked to this PO",
        severity: :error
      }
      return blockers
    end

    linked_tasks.each do |task|
      if task.status_completed?
        blockers << {
          type: :task_completed,
          task_id: task.id,
          task_name: task.name,
          message: "Task '#{task.name}' is completed - cannot sync dates",
          severity: :error
        }
      elsif task.status_started?
        blockers << {
          type: :task_started,
          task_id: task.id,
          task_name: task.name,
          message: "Task '#{task.name}' has started - date is locked",
          severity: :error
        }
      elsif task.supplier_confirm?
        blockers << {
          type: :supplier_confirmed,
          task_id: task.id,
          task_name: task.name,
          message: "Task '#{task.name}' has supplier confirmation - date is locked",
          severity: :error
        }
      end
    end

    blockers
  end

  # Can we sync? Only if no error-level blockers
  def can_sync?
    blockers = find_blockers
    blockers.none? { |b| b[:severity] == :error }
  end

  # What would change if we sync
  def build_sync_preview
    return nil unless can_sync? && linked_tasks.any?

    primary_task = linked_tasks.find { |t| t.start_date.present? }
    return nil unless primary_task

    preview = { will_update: {} }

    if purchase_order.required_date != primary_task.start_date
      preview[:will_update][:required_date] = {
        from: purchase_order.required_date,
        to: primary_task.start_date,
        diff_days: calculate_date_diff(primary_task)
      }
    end

    if primary_task.supplier_id.present? && purchase_order.supplier_id != primary_task.supplier_id
      preview[:will_update][:supplier] = {
        from: purchase_order.supplier&.display_name,
        to: primary_task.supplier&.display_name
      }
    end

    preview[:nothing_to_sync] = preview[:will_update].empty?
    preview[:source_task] = {
      id: primary_task.id,
      name: primary_task.name,
      task_number: primary_task.task_number
    }

    preview
  end

  # Summary message for UI
  def build_summary
    if linked_tasks.empty?
      return {
        status: :no_tasks,
        message: "No Schedule Master tasks linked to this PO",
        can_sync: false
      }
    end

    blockers = find_blockers
    if blockers.any? { |b| b[:severity] == :error }
      return {
        status: :blocked,
        message: "Sync blocked: #{blockers.first[:message]}",
        can_sync: false
      }
    end

    preview = build_sync_preview
    if preview && preview[:nothing_to_sync]
      return {
        status: :in_sync,
        message: "PO is already in sync with Schedule Master",
        can_sync: false
      }
    end

    {
      status: :ready,
      message: "Ready to sync from Schedule Master",
      can_sync: true
    }
  end

  # Calculate days difference between task start and PO required date
  def calculate_date_diff(task)
    return nil unless task.start_date.present? && purchase_order.required_date.present?
    (task.start_date - purchase_order.required_date).to_i
  end
end
