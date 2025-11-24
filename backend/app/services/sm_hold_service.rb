# frozen_string_literal: true

# SmHoldService - Job hold/release logic for SM Gantt
#
# Handles placing jobs on hold with a hold task and releasing them.
# Manages supplier notifications and cascade re-triggering on release.
#
# See GANTT_ARCHITECTURE_PLAN.md Section 3
#
class SmHoldService
  attr_reader :construction, :options

  def initialize(construction, options = {})
    @construction = construction
    @options = options
  end

  # Place job on hold by creating a hold task at position 1
  def place_on_hold(hold_reason:, notes: nil, user: nil)
    result = {
      success: false,
      hold_task: nil,
      blocked_tasks: [],
      log: nil,
      error: nil
    }

    ActiveRecord::Base.transaction do
      # 1. Check if already on hold
      existing_hold = construction.sm_tasks.hold_tasks.where(status: 'not_started').first
      if existing_hold
        result[:error] = "Job is already on hold: #{existing_hold.hold_reason&.name || 'Unknown reason'}"
        raise ActiveRecord::Rollback
      end

      # 2. Shift all task numbers up by 1
      construction.sm_tasks.order(task_number: :desc).each do |task|
        task.update_column(:task_number, task.task_number + 1)
        task.update_column(:sequence_order, task.sequence_order + 1)
      end

      # 3. Create hold task at position 1
      hold_task = construction.sm_tasks.create!(
        task_number: 1,
        sequence_order: 1,
        name: "HOLD: #{hold_reason.name}",
        status: 'not_started',
        start_date: Date.current,
        end_date: Date.current,
        duration_days: 1,
        is_hold_task: true,
        hold_reason: hold_reason,
        hold_notes: notes,
        hold_started_at: Time.current,
        hold_started_by: user,
        color: hold_reason.color || '#EF4444', # Red
        created_by: user
      )

      # 4. Create dependencies from hold task to all root tasks
      root_tasks = construction.sm_tasks
                              .where.not(id: hold_task.id)
                              .where.not(is_hold_task: true)
                              .left_joins(:predecessor_dependencies)
                              .where(sm_dependencies: { id: nil })

      root_tasks.each do |root_task|
        SmDependency.create!(
          predecessor_task: hold_task,
          successor_task: root_task,
          dependency_type: 'FS',
          lag_days: 0,
          active: true,
          created_by: user
        )
      end

      # 5. Create hold log
      log = SmHoldLog.create!(
        construction: construction,
        hold_task: hold_task,
        hold_reason: hold_reason,
        event_type: 'hold_started',
        notes: notes,
        hold_started_at: Time.current,
        hold_started_by: user,
        affected_task_count: construction.sm_tasks.active.count - 1
      )

      result[:success] = true
      result[:hold_task] = hold_task
      result[:blocked_tasks] = root_tasks.pluck(:id)
      result[:log] = log
    end

    result
  rescue ActiveRecord::RecordInvalid => e
    result[:error] = e.message
    result
  end

  # Release job from hold
  def release_hold(notes: nil, user: nil, trigger_cascade: true)
    result = {
      success: false,
      released_task: nil,
      cascade_result: nil,
      log: nil,
      error: nil
    }

    ActiveRecord::Base.transaction do
      # 1. Find active hold task
      hold_task = construction.sm_tasks.hold_tasks.where(status: 'not_started').first
      unless hold_task
        result[:error] = 'Job is not currently on hold'
        raise ActiveRecord::Rollback
      end

      hold_reason = hold_task.hold_reason

      # 2. Mark hold task as completed
      hold_task.update!(
        status: 'completed',
        completed_at: Time.current,
        hold_released_at: Time.current,
        hold_released_by: user,
        updated_by: user
      )

      # 3. Create release log
      log = SmHoldLog.create!(
        construction: construction,
        hold_task: hold_task,
        hold_reason: hold_reason,
        event_type: 'hold_released',
        notes: notes,
        hold_started_at: hold_task.hold_started_at,
        hold_started_by: hold_task.hold_started_by,
        hold_released_at: Time.current,
        hold_released_by: user,
        hold_duration_days: (Date.current - hold_task.start_date).to_i
      )

      # 4. Trigger cascade if enabled
      if trigger_cascade
        cascade_service = SmCascadeService.new(hold_task)
        cascade_result = cascade_service.execute({
          new_start_date: hold_task.start_date,
          user_id: user&.id,
          tasks_to_cascade: hold_task.successors.pluck(:id)
        })
        result[:cascade_result] = cascade_result
      end

      result[:success] = true
      result[:released_task] = hold_task
      result[:log] = log
    end

    result
  rescue ActiveRecord::RecordInvalid => e
    result[:error] = e.message
    result
  end

  # Get current hold status
  def hold_status
    hold_task = construction.sm_tasks.hold_tasks.where(status: 'not_started').first

    if hold_task
      {
        on_hold: true,
        hold_task_id: hold_task.id,
        hold_reason: hold_task.hold_reason&.name,
        hold_reason_id: hold_task.hold_reason_id,
        hold_notes: hold_task.hold_notes,
        hold_started_at: hold_task.hold_started_at,
        hold_started_by: hold_task.hold_started_by&.name,
        days_on_hold: (Date.current - hold_task.start_date).to_i,
        blocked_task_count: hold_task.successors.count
      }
    else
      {
        on_hold: false,
        hold_task_id: nil,
        hold_reason: nil,
        last_hold: last_hold_log
      }
    end
  end

  # Get hold history for this job
  def hold_history
    SmHoldLog.where(construction: construction)
             .includes(:hold_reason, :hold_started_by, :hold_released_by)
             .order(created_at: :desc)
             .map do |log|
      {
        id: log.id,
        event_type: log.event_type,
        hold_reason: log.hold_reason&.name,
        notes: log.notes,
        started_at: log.hold_started_at,
        started_by: log.hold_started_by&.name,
        released_at: log.hold_released_at,
        released_by: log.hold_released_by&.name,
        duration_days: log.hold_duration_days,
        created_at: log.created_at
      }
    end
  end

  private

  def last_hold_log
    log = SmHoldLog.where(construction: construction, event_type: 'hold_released')
                   .order(created_at: :desc)
                   .first

    return nil unless log

    {
      hold_reason: log.hold_reason&.name,
      released_at: log.hold_released_at,
      duration_days: log.hold_duration_days
    }
  end
end
