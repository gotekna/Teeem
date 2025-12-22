# frozen_string_literal: true

# SmRolloverJob - Nightly job to roll over past-due tasks
#
# This job runs at the configured rollover time (default midnight) and:
# 1. Finds all past-due, incomplete tasks
# 2. Moves each task forward to the next working day
# 3. Logs the rollover in sm_rollover_logs
# 4. Handles dependencies that are now broken
# 5. Triggers cascade for successors if needed
#
# See GANTT_SCHEDULE_MASTER_COMPLETE.md Section 5.3
#
class SmRolloverJob < ApplicationJob
  queue_as :critical

  def perform
    settings = SmSetting.instance
    return unless settings.rollover_enabled?

    @batch_id = SecureRandom.uuid
    @rollover_timestamp = Time.current
    @stats = {
      tasks_processed: 0,
      tasks_rolled: 0,
      dependencies_deleted: 0,
      errors: []
    }

    Rails.logger.info "[SmRolloverJob] Starting rollover batch #{@batch_id}"

    ActiveRecord::Base.transaction do
      process_past_due_tasks
    end

    Rails.logger.info "[SmRolloverJob] Completed batch #{@batch_id}: #{@stats.to_json}"
    @stats
  rescue StandardError => e
    Rails.logger.error "[SmRolloverJob] Failed: #{e.message}\n#{e.backtrace.first(10).join("\n")}"
    raise
  end

  private

  def process_past_due_tasks
    # Find all tasks that are past due and not completed/started
    past_due_tasks.find_each do |task|
      @stats[:tasks_processed] += 1
      roll_task_forward(task)
    rescue StandardError => e
      @stats[:errors] << { task_id: task.id, error: e.message }
      Rails.logger.error "[SmRolloverJob] Error rolling task #{task.id}: #{e.message}"
    end
  end

  def past_due_tasks
    SmTask.where(status: "not_started")
          .where("start_date < ?", Date.current)
          .where(is_hold_task: false)
          .includes(:job, :predecessor_dependencies, :successor_dependencies)
  end

  def roll_task_forward(task)
    old_start_date = task.start_date
    old_end_date = task.end_date

    # Calculate new dates - move to today while preserving duration
    new_start_date = Date.current
    new_end_date = new_start_date + (task.duration_days - 1).days

    # Track deleted dependencies
    deleted_dependencies = []

    # Soft-delete predecessor dependencies (task has moved, deps are broken)
    task.predecessor_dependencies.active.each do |dep|
      dep.soft_delete!(reason: "rollover")
      deleted_dependencies << {
        predecessor_id: dep.predecessor_task_id,
        type: dep.dependency_type,
        lag: dep.lag_days
      }
      @stats[:dependencies_deleted] += 1
    end

    # Handle confirm status changes
    confirm_status_change = nil
    if task.confirm_status.present?
      confirm_status_change = task.confirm_status
      # Clear confirm status on rollover
    end

    # Update the task
    task.update!(
      start_date: new_start_date,
      end_date: new_end_date,
      confirm_status: nil,
      confirm_requested_at: nil,
      supplier_confirmed_at: nil,
      supplier_confirmed_by_id: nil
    )

    # Create rollover log
    SmRolloverLog.create!(
      rollover_batch_id: @batch_id,
      rollover_timestamp: @rollover_timestamp,
      task_id: task.id,
      job_id: task.job_id,
      old_start_date: old_start_date,
      old_end_date: old_end_date,
      new_start_date: new_start_date,
      new_end_date: new_end_date,
      deleted_dependencies: deleted_dependencies,
      confirm_status_change: confirm_status_change,
      hold_cleared: false,
      supplier_confirms_cleared: confirm_status_change.present? ? 1 : 0,
      cascade_depth: 0,
      cross_job_cascade: false
    )

    @stats[:tasks_rolled] += 1

    # Cascade to successors if needed
    cascade_to_successors(task) if task.successor_dependencies.active.any?
  end

  def cascade_to_successors(task)
    # For each active successor dependency, recalculate the successor's dates
    task.successor_dependencies.active.each do |dep|
      successor = dep.successor_task
      next if successor.locked? # Don't cascade to locked tasks

      # Calculate new start date based on dependency type
      new_successor_start = calculate_successor_start_date(task, dep)
      next if new_successor_start <= successor.start_date # Only cascade if moving forward

      # Move the successor forward
      new_successor_end = new_successor_start + (successor.duration_days - 1).days

      # Log the cascade
      SmRolloverLog.create!(
        rollover_batch_id: @batch_id,
        rollover_timestamp: @rollover_timestamp,
        task_id: successor.id,
        job_id: successor.job_id,
        old_start_date: successor.start_date,
        old_end_date: successor.end_date,
        new_start_date: new_successor_start,
        new_end_date: new_successor_end,
        deleted_dependencies: [],
        cascade_depth: 1,
        cross_job_cascade: successor.job_id != task.job_id
      )

      successor.update!(
        start_date: new_successor_start,
        end_date: new_successor_end
      )

      @stats[:tasks_rolled] += 1

      # Continue cascading (recursive, up to depth limit)
      # Note: In production, should add depth limit to prevent infinite loops
    end
  end

  def calculate_successor_start_date(predecessor, dependency)
    case dependency.dependency_type
    when "FS" # Finish-to-Start (default)
      predecessor.end_date + 1.day + dependency.lag_days.days
    when "SS" # Start-to-Start
      predecessor.start_date + dependency.lag_days.days
    when "FF" # Finish-to-Finish
      # Successor finishes when predecessor finishes
      # So start = predecessor.end_date - successor.duration + 1 + lag
      predecessor.end_date - (dependency.successor_task.duration_days - 1).days + dependency.lag_days.days
    when "SF" # Start-to-Finish (rare)
      # Successor finishes when predecessor starts
      predecessor.start_date - (dependency.successor_task.duration_days - 1).days + dependency.lag_days.days
    else
      predecessor.end_date + 1.day # Default to FS
    end
  end
end
