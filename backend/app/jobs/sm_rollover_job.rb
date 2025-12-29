# frozen_string_literal: true

# SmRolloverJob - Daily task rollover for SM Gantt
#
# This job runs daily at midnight and:
# 1. Finds all past-due tasks (not_started, start_date < today)
# 2. Rolls them forward to today's date
# 3. If task was supplier_confirmed → demotes to confirm, notifies user
# 4. If task was confirmed → notifies user of move
# 5. Cascades date changes to successor tasks (same confirm rules apply)
# 6. Creates audit log entries and activity notifications
#
# Confirm Logic:
# - supplier_confirm + moved → clears supplier_confirm, keeps confirm, notifies "re-confirm with supplier"
# - confirm + moved → keeps confirm, notifies "please review"
#
# See Trinity Bible Rules 9.23 (SM Gantt - Rollover)
#
# Usage:
#   SmRolloverJob.perform_now              # Run for all jobs
#   SmRolloverJob.perform_now(job_id: 123) # Run for specific job
#
class SmRolloverJob < ApplicationJob
  queue_as :default

  def perform(options = {})
    @options = options.with_indifferent_access
    @batch_id = SecureRandom.uuid
    @timestamp = Time.current
    @settings = SmSetting.instance
    @calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)

    unless @settings.rollover_enabled?
      Rails.logger.info "[SmRolloverJob] Rollover disabled in settings, skipping"
      return { success: true, skipped: true, reason: "rollover_disabled" }
    end

    today = @settings.today
    Rails.logger.info "[SmRolloverJob] Starting rollover batch #{@batch_id} for date #{today}"

    # Find tasks to roll over
    tasks = find_past_due_tasks(today)

    if tasks.empty?
      Rails.logger.info "[SmRolloverJob] No past-due tasks found"
      return { success: true, rolled_over: 0, cascaded: 0 }
    end

    Rails.logger.info "[SmRolloverJob] Found #{tasks.count} past-due tasks"

    rolled_over = 0
    cascaded = 0
    dependencies_broken = 0

    tasks.find_each do |task|
      result = rollover_task(task, today)
      if result[:success]
        rolled_over += 1
        cascaded += result[:cascaded_count]
        dependencies_broken += result[:dependencies_broken]
      end
    end

    Rails.logger.info "[SmRolloverJob] Completed. Rolled over: #{rolled_over}, Cascaded: #{cascaded}, Dependencies broken: #{dependencies_broken}"

    {
      success: true,
      batch_id: @batch_id,
      rolled_over: rolled_over,
      cascaded: cascaded,
      dependencies_broken: dependencies_broken
    }
  rescue StandardError => e
    Rails.logger.error "[SmRolloverJob] Error: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    { success: false, error: e.message }
  end

  private

  def find_past_due_tasks(today)
    scope = SmTask.where(status: "not_started")
                  .where("start_date < ?", today)
                  .where(is_hold_task: false)  # Don't roll over hold tasks
                  .includes(:job)
                  .order(:job_id, :start_date)

    # Optionally filter by job
    if @options[:job_id].present?
      scope = scope.where(construction_id: @options[:job_id])
    end

    scope
  end

  def rollover_task(task, today)
    days_past_due = (today - task.start_date).to_i
    original_start = task.start_date
    original_end = task.end_date

    # Calculate new dates using working days
    new_start = today
    new_end = @calendar.add_working_days(today, task.duration_days - 1)

    # Track confirm status changes for logging
    supplier_confirm_cleared = false
    confirm_status_change = nil

    # Handle supplier_confirm tasks: go back to just "confirm"
    # If task was supplier_confirmed, clear it but keep confirm = true
    if task.supplier_confirm?
      task.update!(
        supplier_confirm: false,
        confirm: true,  # Keep confirm, just clear supplier_confirm
        confirm_status: "moved_after_confirm"
      )
      supplier_confirm_cleared = true
      confirm_status_change = "supplier_confirm_to_confirm"

      # Notify user that supplier-confirmed task was moved
      create_task_moved_activity(task, original_start, new_start, "supplier_confirm")
      Rails.logger.info "[SmRolloverJob] Task #{task.id} was supplier_confirmed - demoted to confirm"
    elsif task.confirm?
      # Task was confirmed - notify user it's being moved
      task.update!(confirm_status: "moved_after_confirm")
      confirm_status_change = "confirm_moved"

      create_task_moved_activity(task, original_start, new_start, "confirm")
      Rails.logger.info "[SmRolloverJob] Task #{task.id} was confirmed - notifying user of move"
    end

    # Update the task dates
    task.update!(
      start_date: new_start,
      end_date: new_end,
      updated_at: @timestamp
    )

    # Create rollover log
    SmRolloverLog.create!(
      task: task,
      job: task.job,
      rollover_batch_id: @batch_id,
      rollover_timestamp: @timestamp,
      old_start_date: original_start,
      old_end_date: original_end,
      new_start_date: new_start,
      new_end_date: new_end,
      supplier_confirms_cleared: supplier_confirm_cleared ? 1 : 0,
      confirm_status_change: confirm_status_change
    )

    # Cascade to successors
    cascaded_count = cascade_to_successors(task, days_past_due)

    Rails.logger.debug "[SmRolloverJob] Rolled task #{task.id} '#{task.name}' forward #{days_past_due} days"

    { success: true, cascaded_count: cascaded_count, dependencies_broken: 0 }
  rescue StandardError => e
    Rails.logger.error "[SmRolloverJob] Failed to roll task #{task.id}: #{e.message}"
    { success: false, error: e.message, cascaded_count: 0, dependencies_broken: 0 }
  end

  def cascade_to_successors(task, days_shifted)
    return 0 if days_shifted == 0

    cascaded = 0

    # Find successor tasks that should cascade
    task.active_successor_dependencies.includes(:successor_task).find_each do |dep|
      successor = dep.successor_task
      next unless successor.present?
      next unless successor.status_not_started?

      # Skip started/completed tasks - can't move those
      next if successor.status_started? || successor.status_completed?

      original_start = successor.start_date

      # Calculate new dates based on dependency type (respects working days)
      new_dates = calculate_successor_dates(successor, dep, task)

      # Handle confirm status changes for successor
      if successor.supplier_confirm?
        # Demote from supplier_confirm to confirm
        successor.update!(
          supplier_confirm: false,
          confirm: true,
          confirm_status: "moved_after_confirm"
        )
        create_task_moved_activity(successor, original_start, new_dates[:start_date], "supplier_confirm")
        Rails.logger.info "[SmRolloverJob] Successor #{successor.id} was supplier_confirmed - demoted to confirm"
      elsif successor.confirm?
        # Just notify that confirmed task moved
        successor.update!(confirm_status: "moved_after_confirm")
        create_task_moved_activity(successor, original_start, new_dates[:start_date], "confirm")
        Rails.logger.info "[SmRolloverJob] Successor #{successor.id} was confirmed - notifying user of move"
      end

      # Update dates
      successor.update!(
        start_date: new_dates[:start_date],
        end_date: new_dates[:end_date],
        updated_at: @timestamp
      )

      cascaded += 1

      # Recursively cascade to further successors
      cascaded += cascade_to_successors(successor, days_shifted)
    end

    cascaded
  end

  # Calculate successor dates based on dependency type (mirrors SmCascadeService logic)
  def calculate_successor_dates(successor, dep, predecessor)
    case dep.dependency_type
    when "FS" # Finish-to-Start
      new_start = @calendar.add_working_days(predecessor.end_date, dep.lag_days + 1)
    when "SS" # Start-to-Start
      new_start = @calendar.add_working_days(predecessor.start_date, dep.lag_days)
    when "FF" # Finish-to-Finish
      target_end = @calendar.add_working_days(predecessor.end_date, dep.lag_days)
      new_start = @calendar.subtract_working_days(target_end, successor.duration_days - 1)
    when "SF" # Start-to-Finish
      target_end = @calendar.add_working_days(predecessor.start_date, dep.lag_days)
      new_start = @calendar.subtract_working_days(target_end, successor.duration_days - 1)
    else
      new_start = @calendar.add_working_days(predecessor.end_date, dep.lag_days + 1)
    end

    {
      start_date: new_start,
      end_date: @calendar.add_working_days(new_start, successor.duration_days - 1)
    }
  end

  # Create an activity notification when a confirmed/supplier_confirmed task is moved by rollover
  def create_task_moved_activity(task, old_start, new_start, was_status)
    return unless task.job.present?

    message = if was_status == "supplier_confirm"
                "Task '#{task.name}' was moved by rollover from #{old_start} to #{new_start}. " \
                "Supplier confirmation cleared - please re-confirm with supplier."
    else
                "Task '#{task.name}' was moved by rollover from #{old_start} to #{new_start}. " \
                "Please review and re-confirm if needed."
    end

    SmActivity.track(
      "schedule_updated",
      construction: task.job,
      task: task,
      trackable: task,
      metadata: {
        task_name: task.name,
        old_start_date: old_start.to_s,
        new_start_date: new_start.to_s,
        was_status: was_status,
        reason: "rollover",
        message: message
      }
    )
  end
end
