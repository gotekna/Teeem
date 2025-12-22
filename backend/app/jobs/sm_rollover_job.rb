# frozen_string_literal: true

# SmRolloverJob - Daily task rollover for SM Gantt
#
# This job runs daily at the configured rollover time and:
# 1. Finds all past-due tasks that are not started
# 2. Rolls them forward to today's date
# 3. Cascades date changes to successor tasks
# 4. Creates audit log entries
#
# See Trinity Bible Rules 9.23 (SM Gantt - Rollover)
# See GANTT_ARCHITECTURE_PLAN.md Section 2.3
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

    tasks.find_each do |task|
      result = rollover_task(task, today)
      if result[:success]
        rolled_over += 1
        cascaded += result[:cascaded_count]
      end
    end

    Rails.logger.info "[SmRolloverJob] Completed. Rolled over: #{rolled_over}, Cascaded: #{cascaded}"

    {
      success: true,
      batch_id: @batch_id,
      rolled_over: rolled_over,
      cascaded: cascaded
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

    # Calculate new dates
    new_start = today
    new_end = today + (task.duration_days - 1).days

    # Update the task
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
      original_start_date: original_start,
      original_end_date: original_end,
      new_start_date: new_start,
      new_end_date: new_end,
      days_rolled: days_past_due
    )

    # Cascade to successors
    cascaded_count = cascade_to_successors(task, days_past_due)

    Rails.logger.debug "[SmRolloverJob] Rolled task #{task.id} '#{task.name}' forward #{days_past_due} days"

    { success: true, cascaded_count: cascaded_count }
  rescue StandardError => e
    Rails.logger.error "[SmRolloverJob] Failed to roll task #{task.id}: #{e.message}"
    { success: false, error: e.message, cascaded_count: 0 }
  end

  def cascade_to_successors(task, days_shifted)
    return 0 if days_shifted == 0

    cascaded = 0

    # Find successor tasks that should cascade
    task.active_successor_dependencies.includes(:successor_task).find_each do |dep|
      successor = dep.successor_task
      next unless successor.present?

      # Only cascade to unlocked, not-started tasks
      next if successor.locked?
      next unless successor.status_not_started?

      # Calculate new dates for successor
      new_start = successor.start_date + days_shifted.days
      new_end = successor.end_date + days_shifted.days

      successor.update!(
        start_date: new_start,
        end_date: new_end,
        updated_at: @timestamp
      )

      cascaded += 1

      # Recursively cascade to further successors
      cascaded += cascade_to_successors(successor, days_shifted)
    end

    cascaded
  end
end
