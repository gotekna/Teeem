# frozen_string_literal: true

# SmRolloverJob - Daily task rollover for SM Gantt
#
# This job runs daily at the configured rollover time and:
# 1. Finds all past-due tasks that are not started
# 2. Rolls them forward to today's date
# 3. BREAKS dependencies to locked predecessors (supplier_confirm, confirm, started, completed, hold)
# 4. Clears supplier_confirm and sets confirm_status on affected tasks
# 5. Cascades date changes to successor tasks
# 6. Creates audit log entries and user notifications
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

    # CRITICAL: Break dependencies to locked predecessors BEFORE rolling
    # This clears supplier_confirm and sets confirm_status on the task
    broken_deps = break_locked_predecessor_dependencies(task)

    # Update the task dates
    task.update!(
      start_date: new_start,
      end_date: new_end,
      updated_at: @timestamp
    )

    # Create rollover log with broken dependency info
    SmRolloverLog.create!(
      task: task,
      job: task.job,
      rollover_batch_id: @batch_id,
      rollover_timestamp: @timestamp,
      old_start_date: original_start,
      old_end_date: original_end,
      new_start_date: new_start,
      new_end_date: new_end,
      deleted_dependencies: broken_deps,
      supplier_confirms_cleared: broken_deps.any? ? 1 : 0,
      confirm_status_change: broken_deps.any? ? "moved_after_confirm" : nil
    )

    # Cascade to successors
    cascaded_count = cascade_to_successors(task, days_past_due)

    Rails.logger.debug "[SmRolloverJob] Rolled task #{task.id} '#{task.name}' forward #{days_past_due} days, broke #{broken_deps.count} dependencies"

    { success: true, cascaded_count: cascaded_count, dependencies_broken: broken_deps.count }
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

      # Only cascade to unlocked, not-started tasks
      next if successor.locked?
      next unless successor.status_not_started?

      # Calculate new dates based on dependency type (respects working days)
      new_dates = calculate_successor_dates(successor, dep, task)

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

  # Break dependencies to locked predecessors (Trinity Bible Rules 9.23)
  # When a task is past-due and must roll forward, but has a locked predecessor,
  # the dependency is broken to allow the task to move freely.
  def break_locked_predecessor_dependencies(task)
    broken = []

    task.active_predecessor_dependencies.includes(:predecessor_task).find_each do |dep|
      predecessor = dep.predecessor_task
      next unless predecessor.present?

      # If predecessor is locked, break the dependency
      next unless predecessor.locked?

      lock_type = predecessor.lock_type

      # Soft delete the dependency using the model's method
      dep.soft_delete!(reason: "rollover")

      # Clear supplier_confirm and set confirm_status on the rolled task
      # Only update if the task had supplier_confirm set
      if task.supplier_confirm?
        task.update!(
          supplier_confirm: false,
          confirm_status: "moved_after_confirm"
        )
      end

      # Create activity notification for the user
      create_dependency_break_activity(predecessor, task, dep, lock_type)

      Rails.logger.info "[SmRolloverJob] Broke dependency #{predecessor.id}->#{task.id}: predecessor '#{predecessor.name}' is #{lock_type}"

      broken << {
        predecessor_task_id: predecessor.id,
        predecessor_task_name: predecessor.name,
        predecessor_lock_type: lock_type,
        dependency_type: dep.dependency_type,
        broken_at: @timestamp.iso8601
      }
    end

    broken
  end

  # Create an activity notification when a dependency is broken by rollover
  def create_dependency_break_activity(predecessor, successor, dep, lock_type)
    return unless successor.job.present?

    SmActivity.track(
      "dependency_removed",
      construction: successor.job,
      task: successor,
      trackable: dep,
      metadata: {
        task_name: successor.name,
        predecessor_name: predecessor.name,
        predecessor_task_number: predecessor.task_number,
        lock_type: lock_type,
        dependency_type: dep.dependency_type,
        reason: "rollover",
        message: "Dependency from '#{predecessor.name}' was automatically broken by rollover (predecessor is #{lock_type})"
      }
    )
  end
end
