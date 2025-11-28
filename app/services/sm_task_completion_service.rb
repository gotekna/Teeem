# frozen_string_literal: true

# SmTaskCompletionService - Handles task completion and spawning follow-up tasks
#
# When a task is completed, this service:
# 1. Updates the task status to completed
# 2. Spawns follow-up tasks based on configuration (photo, scan, office tasks)
# 3. Handles pass/fail inspections with retry spawning
# 4. Logs all spawned tasks for audit trail
#
# See GANTT_ARCHITECTURE_PLAN.md Section 10 (Task Spawning System)
#
class SmTaskCompletionService
  attr_reader :task, :user, :errors

  SPAWN_TYPES = %w[photo scan office inspection_retry].freeze

  def initialize(task, user: nil)
    @task = task
    @user = user
    @errors = []
    @spawned_tasks = []
  end

  # Complete a task with optional pass/fail for inspections
  # Returns { success: bool, task: SmTask, spawned_tasks: [], errors: [] }
  def complete(passed: nil)
    ActiveRecord::Base.transaction do
      # Validate task can be completed
      unless can_complete?
        return failure_result
      end

      # Update task status
      complete_task!(passed)

      # Handle spawning based on completion result
      if task.pass_fail_enabled? && passed == false
        # Failed inspection - spawn retry task
        spawn_inspection_retry
      else
        # Normal completion - spawn configured follow-up tasks
        spawn_follow_up_tasks
      end

      success_result
    end
  rescue StandardError => e
    @errors << "Completion failed: #{e.message}"
    Rails.logger.error("SmTaskCompletionService error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    failure_result
  end

  # Preview what tasks would be spawned (dry run)
  def preview_spawns
    spawns = []

    if task.pass_fail_enabled?
      spawns << { type: 'inspection_retry', condition: 'if inspection fails' }
    end

    if task.spawn_photo_task?
      spawns << { type: 'photo', name: "#{task.name} - Photos", condition: 'on completion' }
    end

    if task.spawn_scan_task?
      spawns << { type: 'scan', name: "#{task.name} - Document Scan", condition: 'on completion' }
    end

    if task.spawn_office_tasks.present?
      task.spawn_office_tasks.each do |office_task|
        spawns << {
          type: 'office',
          name: office_task['name'] || 'Office Task',
          condition: 'on completion'
        }
      end
    end

    spawns
  end

  private

  def can_complete?
    if task.status_completed?
      @errors << 'Task is already completed'
      return false
    end

    if task.is_hold_task? && task.hold_active?
      @errors << 'Cannot complete a hold task while hold is active'
      return false
    end

    true
  end

  def complete_task!(passed)
    attrs = {
      status: 'completed',
      completed_at: Time.current,
      updated_by: user
    }

    # Only set passed if pass_fail is enabled
    if task.pass_fail_enabled?
      attrs[:passed] = passed
    end

    task.update!(attrs)
  end

  def spawn_follow_up_tasks
    spawn_photo_task if task.spawn_photo_task?
    spawn_scan_task if task.spawn_scan_task?
    spawn_office_tasks if task.spawn_office_tasks.present?
  end

  def spawn_photo_task
    spawned = create_spawned_task(
      name: "#{task.name} - Photos",
      description: "Take completion photos for: #{task.name}",
      spawn_type: 'photo',
      duration_days: 1,
      require_photo: true
    )
    log_spawn(spawned, 'photo', 'parent_complete') if spawned
  end

  def spawn_scan_task
    spawned = create_spawned_task(
      name: "#{task.name} - Document Scan",
      description: "Scan documents for: #{task.name}",
      spawn_type: 'scan',
      duration_days: 1
    )
    log_spawn(spawned, 'scan', 'parent_complete') if spawned
  end

  def spawn_office_tasks
    task.spawn_office_tasks.each do |office_config|
      spawned = create_spawned_task(
        name: office_config['name'] || "#{task.name} - Office Task",
        description: office_config['description'] || "Office follow-up for: #{task.name}",
        spawn_type: 'office',
        duration_days: office_config['duration_days'] || 1,
        assigned_user_id: office_config['assigned_user_id'],
        trade: 'Office'
      )
      log_spawn(spawned, 'office', 'parent_complete') if spawned
    end
  end

  def spawn_inspection_retry
    retry_count = task.parent_spawn_logs.where(spawn_type: 'inspection_retry').count

    spawned = create_spawned_task(
      name: "#{task.name} - Retry ##{retry_count + 1}",
      description: "Inspection retry for failed task: #{task.name}",
      spawn_type: 'inspection_retry',
      duration_days: task.duration_days,
      pass_fail_enabled: true,
      # Inherit key settings from parent
      spawn_photo_task: task.spawn_photo_task,
      spawn_scan_task: task.spawn_scan_task,
      spawn_office_tasks: task.spawn_office_tasks,
      trade: task.trade,
      supplier_id: task.supplier_id,
      checklist_id: task.checklist_id
    )
    log_spawn(spawned, 'inspection_retry', 'inspection_fail') if spawned
  end

  def create_spawned_task(attrs)
    # Get next task number
    max_number = SmTask.where(construction_id: task.construction_id).maximum(:task_number) || 0

    # Get sequence order (place right after parent task)
    new_sequence = task.sequence_order + 0.01

    spawned = SmTask.create!(
      construction_id: task.construction_id,
      parent_task_id: task.id,
      task_number: max_number + 1,
      sequence_order: new_sequence,
      start_date: Date.current,
      end_date: Date.current + (attrs[:duration_days] || 1) - 1,
      duration_days: attrs[:duration_days] || 1,
      status: 'not_started',
      created_by: user,
      **attrs.except(:spawn_type)
    )

    @spawned_tasks << spawned
    spawned
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Failed to spawn #{attrs[:spawn_type]} task: #{e.message}"
    Rails.logger.error("Failed to spawn task: #{e.message}")
    nil
  end

  def log_spawn(spawned_task, spawn_type, spawn_trigger)
    SmSpawnLog.create!(
      parent_task: task,
      spawned_task: spawned_task,
      spawn_type: spawn_type,
      spawn_trigger: spawn_trigger,
      spawned_by: user
    )
  end

  def success_result
    {
      success: true,
      task: task.reload,
      spawned_tasks: @spawned_tasks,
      errors: []
    }
  end

  def failure_result
    {
      success: false,
      task: task,
      spawned_tasks: [],
      errors: @errors
    }
  end
end
