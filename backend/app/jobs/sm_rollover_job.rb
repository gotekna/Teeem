# frozen_string_literal: true

# SmRolloverJob - Automated midnight rollover for SM Gantt
#
# Runs at midnight to move past-due tasks to today.
# Respects locks and creates logs for audit trail.
#
# See GANTT_ARCHITECTURE_PLAN.md Section 8
#
# Schedule with Solid Queue:
#   SmRolloverJob.set(wait_until: next_rollover_time).perform_later
#
class SmRolloverJob < ApplicationJob
  queue_as :default

  # Retry on failure with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(company_id: nil)
    settings = SmSetting.instance
    return unless settings.rollover_enabled?

    timezone = settings.rollover_timezone || 'Australia/Sydney'
    today = Time.current.in_time_zone(timezone).to_date

    # Find all past-due tasks
    past_due_tasks = find_past_due_tasks(today, company_id)

    Rails.logger.info "[SmRolloverJob] Found #{past_due_tasks.count} past-due tasks"

    results = {
      processed: 0,
      moved: 0,
      skipped_locked: 0,
      skipped_hold: 0,
      cascade_triggered: 0,
      errors: []
    }

    past_due_tasks.find_each do |task|
      process_task(task, today, results)
    end

    # Log overall rollover
    create_rollover_summary_log(today, results)

    # Schedule next rollover
    schedule_next_rollover(settings) if settings.rollover_enabled?

    results
  end

  private

  def find_past_due_tasks(today, company_id)
    scope = SmTask.joins(:construction)
                  .where('sm_tasks.start_date < ?', today)
                  .where.not(status: 'completed')
                  .where(is_hold_task: false)
                  .order(:construction_id, :sequence_order)

    if company_id
      scope = scope.where(constructions: { company_id: company_id })
    end

    scope
  end

  def process_task(task, today, results)
    results[:processed] += 1

    # Skip hold tasks
    if task.is_hold_task?
      results[:skipped_hold] += 1
      return
    end

    # Check locks
    if task.locked?
      handle_locked_task(task, today, results)
      return
    end

    # Move task to today
    move_task_to_today(task, today, results)
  rescue StandardError => e
    results[:errors] << { task_id: task.id, error: e.message }
    Rails.logger.error "[SmRolloverJob] Error processing task #{task.id}: #{e.message}"
  end

  def handle_locked_task(task, today, results)
    results[:skipped_locked] += 1

    # Log that we skipped this locked task
    SmRolloverLog.create!(
      sm_task: task,
      construction: task.construction,
      rollover_date: today,
      original_start_date: task.start_date,
      original_end_date: task.end_date,
      new_start_date: task.start_date, # No change
      new_end_date: task.end_date,
      was_skipped: true,
      skip_reason: "locked_#{task.lock_type}",
      lock_type_at_rollover: task.lock_type
    )
  end

  def move_task_to_today(task, today, results)
    original_start = task.start_date
    original_end = task.end_date

    # Calculate new dates
    calendar = WorkingDaysCalculator.new(task.construction.company_setting)
    new_start = today
    new_end = calendar.add_working_days(new_start, task.duration_days - 1)

    # Update task
    task.update!(
      start_date: new_start,
      end_date: new_end
    )

    results[:moved] += 1

    # Create rollover log
    SmRolloverLog.create!(
      sm_task: task,
      construction: task.construction,
      rollover_date: today,
      original_start_date: original_start,
      original_end_date: original_end,
      new_start_date: new_start,
      new_end_date: new_end,
      days_rolled: (today - original_start).to_i,
      was_skipped: false
    )

    # Trigger cascade for successors
    if task.active_successor_dependencies.any?
      cascade_service = SmCascadeService.new(task)
      cascade_service.execute_rollover
      results[:cascade_triggered] += 1
    end
  end

  def create_rollover_summary_log(today, results)
    # Could create a summary log entry if needed
    Rails.logger.info "[SmRolloverJob] Rollover complete for #{today}: #{results.to_json}"
  end

  def schedule_next_rollover(settings)
    timezone = settings.rollover_timezone || 'Australia/Sydney'
    rollover_time = settings.rollover_time || '00:00'

    # Parse rollover time
    hour, minute = rollover_time.split(':').map(&:to_i)

    # Calculate next rollover time
    now = Time.current.in_time_zone(timezone)
    next_run = now.change(hour: hour, min: minute)

    # If we've passed today's rollover time, schedule for tomorrow
    next_run += 1.day if next_run <= now

    # Schedule the job
    SmRolloverJob.set(wait_until: next_run).perform_later

    Rails.logger.info "[SmRolloverJob] Next rollover scheduled for #{next_run}"
  end

  class << self
    # Manual trigger for testing or one-off runs
    def run_now(company_id: nil)
      new.perform(company_id: company_id)
    end

    # Start the recurring job (call this on app startup)
    def start_recurring
      settings = SmSetting.instance
      return unless settings.rollover_enabled?

      # Schedule first run
      timezone = settings.rollover_timezone || 'Australia/Sydney'
      rollover_time = settings.rollover_time || '00:00'
      hour, minute = rollover_time.split(':').map(&:to_i)

      now = Time.current.in_time_zone(timezone)
      next_run = now.change(hour: hour, min: minute)
      next_run += 1.day if next_run <= now

      SmRolloverJob.set(wait_until: next_run).perform_later

      Rails.logger.info "[SmRolloverJob] Recurring job started, first run at #{next_run}"
    end
  end
end