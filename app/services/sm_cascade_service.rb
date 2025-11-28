# frozen_string_literal: true

# SmCascadeService - Core cascade engine for SM Gantt
#
# Handles dependency propagation when tasks are moved.
# Respects lock hierarchy and provides preview/execute modes.
#
# See GANTT_ARCHITECTURE_PLAN.md Section 6.1
#
class SmCascadeService
  # Lock priority (lower = stronger lock)
  LOCK_PRIORITY = {
    'supplier_confirm' => 1,
    'confirm' => 2,
    'started' => 3,
    'completed' => 4,
    'manually_positioned' => 5
  }.freeze

  attr_reader :task, :construction, :options, :calendar

  def initialize(task, options = {})
    @task = task
    @construction = task.construction
    @options = options
    @calendar = WorkingDaysCalculator.new(construction.company_setting)
  end

  # Preview cascade without making changes
  # Returns categorized successors for the cascade modal
  def preview(new_start_date)
    date_delta = calculate_date_delta(new_start_date)

    {
      moved_task: {
        id: task.id,
        name: task.name,
        old_start_date: task.start_date,
        new_start_date: new_start_date,
        old_end_date: task.end_date,
        new_end_date: calculate_new_end_date(new_start_date),
        date_delta: date_delta
      },
      unlocked_successors: find_unlocked_successors(date_delta),
      blocked_successors: find_blocked_successors(date_delta),
      cross_job_tasks: find_cross_job_successors(date_delta),
      summary: build_summary(date_delta)
    }
  end

  # Execute cascade with user decisions from modal
  def execute(cascade_params)
    results = {
      updated_tasks: [],
      broken_dependencies: [],
      unlocked_tasks: [],
      errors: []
    }

    ActiveRecord::Base.transaction do
      # 1. Update the source task first
      new_start = cascade_params[:new_start_date]
      new_end = calculate_new_end_date(new_start)

      task.update!(
        start_date: new_start,
        end_date: new_end,
        updated_by_id: cascade_params[:user_id]
      )
      results[:updated_tasks] << task

      # 2. Process tasks to cascade (move with parent)
      cascade_params[:tasks_to_cascade]&.each do |task_id|
        successor = SmTask.find(task_id)
        new_dates = calculate_successor_dates(successor)

        successor.update!(
          start_date: new_dates[:start_date],
          end_date: new_dates[:end_date],
          updated_by_id: cascade_params[:user_id]
        )
        results[:updated_tasks] << successor

        # Recursively cascade this task's unlocked successors
        cascade_unlocked_successors(successor, results, cascade_params[:user_id])
      end

      # 3. Process tasks to break (break dependency, task stays in place)
      cascade_params[:tasks_to_break]&.each do |task_id|
        dep = SmDependency.find_by(
          successor_task_id: task_id,
          predecessor_task_id: task.id,
          active: true
        )

        if dep
          dep.update!(
            active: false,
            deleted_at: Time.current,
            deleted_reason: 'cascade_conflict',
            deleted_by_id: cascade_params[:user_id]
          )
          results[:broken_dependencies] << dep
        end
      end

      # 4. Process tasks to unlock (clear locks and cascade)
      cascade_params[:tasks_to_unlock]&.each do |task_id|
        successor = SmTask.find(task_id)

        successor.update!(
          supplier_confirm: false,
          confirm: false,
          manually_positioned: false,
          manually_positioned_at: nil,
          confirm_status: successor.supplier_confirm? ? 'moved_after_confirm' : nil,
          updated_by_id: cascade_params[:user_id]
        )
        results[:unlocked_tasks] << successor

        # Now cascade this unlocked task
        new_dates = calculate_successor_dates(successor)
        successor.update!(
          start_date: new_dates[:start_date],
          end_date: new_dates[:end_date]
        )
        results[:updated_tasks] << successor
      end
    end

    results
  rescue ActiveRecord::RecordInvalid => e
    results[:errors] << e.message
    results
  end

  # Execute cascade in rollover mode (automatic, no user confirmation)
  def execute_rollover
    results = {
      updated_tasks: [],
      deleted_dependencies: [],
      supplier_confirms_cleared: 0
    }

    # Auto-cascade all unlocked successors
    cascade_unlocked_successors_rollover(task, results)

    results
  end

  private

  def calculate_date_delta(new_start_date)
    new_start = new_start_date.is_a?(String) ? Date.parse(new_start_date) : new_start_date
    (new_start - task.start_date).to_i
  end

  def calculate_new_end_date(new_start_date)
    new_start = new_start_date.is_a?(String) ? Date.parse(new_start_date) : new_start_date
    calendar.add_working_days(new_start, task.duration_days - 1)
  end

  def find_unlocked_successors(date_delta)
    direct_successors.reject { |s| locked?(s[:task]) }.map do |s|
      new_dates = calculate_successor_dates_preview(s[:task], s[:dependency], date_delta)
      {
        id: s[:task].id,
        task_number: s[:task].task_number,
        name: s[:task].name,
        dependency_type: s[:dependency].dependency_type,
        lag_days: s[:dependency].lag_days,
        old_start_date: s[:task].start_date,
        new_start_date: new_dates[:start_date],
        old_end_date: s[:task].end_date,
        new_end_date: new_dates[:end_date],
        trade: s[:task].trade,
        supplier_name: s[:task].supplier&.company_name,
        nested_count: count_nested_successors(s[:task])
      }
    end
  end

  def find_blocked_successors(date_delta)
    direct_successors.select { |s| locked?(s[:task]) }.map do |s|
      new_dates = calculate_successor_dates_preview(s[:task], s[:dependency], date_delta)
      {
        id: s[:task].id,
        task_number: s[:task].task_number,
        name: s[:task].name,
        dependency_type: s[:dependency].dependency_type,
        lag_days: s[:dependency].lag_days,
        old_start_date: s[:task].start_date,
        would_move_to: new_dates[:start_date],
        lock_type: get_lock_type(s[:task]),
        lock_priority: get_lock_priority(s[:task]),
        unlockable: unlockable?(s[:task]),
        trade: s[:task].trade,
        supplier_name: s[:task].supplier&.company_name,
        supplier_confirmed_at: s[:task].supplier_confirmed_at,
        nested_successors: find_nested_locked_summary(s[:task])
      }
    end
  end

  def find_cross_job_successors(date_delta)
    # Find dependencies that cross job boundaries
    SmDependency.where(predecessor_task_id: task.id, active: true)
                .joins(:successor_task)
                .where.not(sm_tasks: { construction_id: construction.id })
                .map do |dep|
      successor = dep.successor_task
      {
        id: successor.id,
        task_number: successor.task_number,
        name: successor.name,
        construction_id: successor.construction_id,
        construction_title: successor.construction.title,
        dependency_type: dep.dependency_type,
        lag_days: dep.lag_days,
        locked: locked?(successor),
        lock_type: get_lock_type(successor)
      }
    end
  end

  def direct_successors
    @direct_successors ||= task.active_successor_dependencies.includes(:successor_task).map do |dep|
      { task: dep.successor_task, dependency: dep }
    end
  end

  def locked?(task)
    task.supplier_confirm? ||
    task.confirm? ||
    task.status_started? ||
    task.status_completed? ||
    task.manually_positioned?
  end

  def unlockable?(task)
    # Started and completed cannot be unlocked
    return false if task.status_started? || task.status_completed?
    # Others can be cleared
    task.supplier_confirm? || task.confirm? || task.manually_positioned?
  end

  def get_lock_type(task)
    return 'supplier_confirm' if task.supplier_confirm?
    return 'confirm' if task.confirm?
    return 'started' if task.status_started?
    return 'completed' if task.status_completed?
    return 'manually_positioned' if task.manually_positioned?
    nil
  end

  def get_lock_priority(task)
    lock_type = get_lock_type(task)
    LOCK_PRIORITY[lock_type]
  end

  def calculate_successor_dates(successor)
    # Get all active predecessor dependencies for this successor
    deps = successor.active_predecessor_dependencies.includes(:predecessor_task)

    # Calculate the earliest valid start based on all predecessors
    earliest_start = deps.map do |dep|
      predecessor = dep.predecessor_task
      case dep.dependency_type
      when 'FS' # Finish-to-Start
        calendar.add_working_days(predecessor.end_date, dep.lag_days + 1)
      when 'SS' # Start-to-Start
        calendar.add_working_days(predecessor.start_date, dep.lag_days)
      when 'FF' # Finish-to-Finish
        # Work backwards from when predecessor finishes
        target_end = calendar.add_working_days(predecessor.end_date, dep.lag_days)
        calendar.subtract_working_days(target_end, successor.duration_days - 1)
      when 'SF' # Start-to-Finish (rare)
        target_end = calendar.add_working_days(predecessor.start_date, dep.lag_days)
        calendar.subtract_working_days(target_end, successor.duration_days - 1)
      else
        predecessor.end_date + 1.day
      end
    end.compact.max || successor.start_date

    {
      start_date: earliest_start,
      end_date: calendar.add_working_days(earliest_start, successor.duration_days - 1)
    }
  end

  def calculate_successor_dates_preview(successor, dependency, date_delta)
    predecessor = task

    case dependency.dependency_type
    when 'FS'
      new_pred_end = task.end_date + date_delta.days
      new_start = calendar.add_working_days(new_pred_end, dependency.lag_days + 1)
    when 'SS'
      new_pred_start = task.start_date + date_delta.days
      new_start = calendar.add_working_days(new_pred_start, dependency.lag_days)
    when 'FF'
      new_pred_end = task.end_date + date_delta.days
      target_end = calendar.add_working_days(new_pred_end, dependency.lag_days)
      new_start = calendar.subtract_working_days(target_end, successor.duration_days - 1)
    when 'SF'
      new_pred_start = task.start_date + date_delta.days
      target_end = calendar.add_working_days(new_pred_start, dependency.lag_days)
      new_start = calendar.subtract_working_days(target_end, successor.duration_days - 1)
    else
      new_start = successor.start_date + date_delta.days
    end

    {
      start_date: new_start,
      end_date: calendar.add_working_days(new_start, successor.duration_days - 1)
    }
  end

  def count_nested_successors(task)
    SmDependency.where(predecessor_task_id: task.id, active: true).count
  end

  def find_nested_locked_summary(task)
    # Get immediate successors that are also locked
    SmDependency.where(predecessor_task_id: task.id, active: true)
                .includes(:successor_task)
                .select { |dep| locked?(dep.successor_task) }
                .map do |dep|
      {
        id: dep.successor_task.id,
        name: dep.successor_task.name,
        lock_type: get_lock_type(dep.successor_task)
      }
    end
  end

  def cascade_unlocked_successors(task, results, user_id)
    task.active_successor_dependencies.includes(:successor_task).each do |dep|
      successor = dep.successor_task
      next if locked?(successor)
      next if results[:updated_tasks].include?(successor)

      new_dates = calculate_successor_dates(successor)
      successor.update!(
        start_date: new_dates[:start_date],
        end_date: new_dates[:end_date],
        updated_by_id: user_id
      )
      results[:updated_tasks] << successor

      # Recursively cascade
      cascade_unlocked_successors(successor, results, user_id)
    end
  end

  def cascade_unlocked_successors_rollover(task, results)
    task.active_successor_dependencies.includes(:successor_task).each do |dep|
      successor = dep.successor_task

      if locked?(successor)
        # Break dependency for locked successors during rollover
        dep.update!(
          active: false,
          deleted_at: Time.current,
          deleted_reason: 'rollover',
          deleted_by_rollover: true
        )
        results[:deleted_dependencies] << {
          id: dep.id,
          predecessor_id: dep.predecessor_task_id,
          successor_id: dep.successor_task_id
        }

        # Clear supplier confirms during rollover
        if successor.supplier_confirm?
          successor.update!(
            supplier_confirm: false,
            confirm_status: 'moved_after_confirm'
          )
          results[:supplier_confirms_cleared] += 1
        end
      else
        next if results[:updated_tasks].include?(successor)

        new_dates = calculate_successor_dates(successor)
        successor.update!(
          start_date: new_dates[:start_date],
          end_date: new_dates[:end_date]
        )
        results[:updated_tasks] << successor

        # Recursively cascade
        cascade_unlocked_successors_rollover(successor, results)
      end
    end
  end

  def build_summary(date_delta)
    unlocked = find_unlocked_successors(date_delta)
    blocked = find_blocked_successors(date_delta)
    cross_job = find_cross_job_successors(date_delta)

    {
      total_successors: unlocked.count + blocked.count,
      will_cascade: unlocked.count,
      blocked: blocked.count,
      cross_job: cross_job.count,
      direction: date_delta > 0 ? 'forward' : 'backward',
      days_moved: date_delta.abs
    }
  end
end