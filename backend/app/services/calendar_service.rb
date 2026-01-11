# frozen_string_literal: true

# CalendarService - SSoT for calendar data aggregation
#
# Provides task data for calendar views (month, week, day, team, resource)
# Uses SmTask as the single source of truth - calendar is a view layer.
#
# Usage:
#   service = CalendarService.new(organization)
#   events = service.events(start_date: Date.today, end_date: Date.today.end_of_month)
#   capacity = service.capacity(start_date: Date.today, end_date: Date.today.end_of_week, user_ids: [1,2,3])
#
class CalendarService
  def initialize(organization)
    @organization = organization
  end

  # Get calendar events for a date range
  # @param start_date [Date] Range start (required)
  # @param end_date [Date] Range end (required)
  # @param user_ids [Array<Integer>] Filter by assigned users
  # @param role_ids [Array<Integer>] Filter by assigned roles
  # @param job_id [Integer] Filter by job
  # @param statuses [Array<String>] Filter by status (not_started, started, completed)
  # @param include_unassigned [Boolean] Include tasks with no user assignment
  # @param view_mode [String] 'personal', 'team', 'resource'
  # @return [Hash] Events data with metadata
  def events(start_date:, end_date:, user_ids: nil, role_ids: nil, job_id: nil,
             statuses: nil, include_unassigned: true, view_mode: "personal")
    tasks = base_query
      .for_date_range(start_date, end_date)
      .includes(:job, :assigned_user, :sm_schedule_master, :hold_reason)

    # Apply filters
    tasks = apply_user_filter(tasks, user_ids, include_unassigned)
    tasks = tasks.where(assigned_role: role_ids) if role_ids.present?
    tasks = tasks.where(job_id: job_id) if job_id.present?
    tasks = tasks.where(status: statuses) if statuses.present?

    # Order by start date
    tasks = tasks.order(:start_date, :sequence_order)

    # Transform to calendar events
    events = tasks.map { |task| task_to_event(task) }

    # Group by date for calendar rendering
    events_by_date = group_events_by_date(events, start_date, end_date)

    {
      events: events,
      events_by_date: events_by_date,
      meta: build_meta(tasks, start_date, end_date)
    }
  end

  # Get capacity data for users/resources
  # @param start_date [Date] Range start
  # @param end_date [Date] Range end
  # @param user_ids [Array<Integer>] Users to include
  # @return [Hash] Capacity data by user and date
  def capacity(start_date:, end_date:, user_ids: nil)
    users = if user_ids.present?
              User.where(id: user_ids)
            else
              User.active.where(organization_id: @organization&.id)
            end

    # Get tasks for all users in range
    tasks = base_query
      .for_date_range(start_date, end_date)
      .where(assigned_user_id: users.pluck(:id))

    # Get absences
    absences = UserAbsence
      .where(user_id: users.pluck(:id))
      .where("start_date <= ? AND end_date >= ?", end_date, start_date)

    # Build capacity data per user
    user_data = users.map do |user|
      user_tasks = tasks.select { |t| t.assigned_user_id == user.id }
      user_absences = absences.select { |a| a.user_id == user.id }

      {
        user_id: user.id,
        user_name: user.name,
        capacity_by_date: build_user_capacity(user, user_tasks, user_absences, start_date, end_date)
      }
    end

    # Find warnings
    warnings = build_capacity_warnings(user_data, tasks)

    {
      users: user_data,
      warnings: warnings
    }
  end

  # Get summary statistics
  def summary(user_id: nil)
    today = Date.current
    tasks = base_query
    tasks = tasks.where(assigned_user_id: user_id) if user_id.present?

    {
      overdue: tasks.where("end_date < ? AND status != ?", today, "completed").count,
      due_today: tasks.where(end_date: today).where.not(status: "completed").count,
      due_this_week: tasks.where(end_date: today..today.end_of_week).where.not(status: "completed").count,
      in_progress: tasks.where(status: "started").count,
      not_started: tasks.where(status: "not_started").count,
      completed_this_week: tasks.where(status: "completed").where("updated_at >= ?", today.beginning_of_week).count
    }
  end

  private

  def base_query
    SmTask.where(is_hold_task: false)
  end

  def apply_user_filter(tasks, user_ids, include_unassigned)
    return tasks if user_ids.blank? && include_unassigned

    if user_ids.present? && include_unassigned
      tasks.where(assigned_user_id: user_ids).or(tasks.where(assigned_user_id: nil))
    elsif user_ids.present?
      tasks.where(assigned_user_id: user_ids)
    else
      tasks.where.not(assigned_user_id: nil)
    end
  end

  def task_to_event(task)
    is_overdue = task.end_date < Date.current && task.status != "completed"
    days_overdue = is_overdue ? (Date.current - task.end_date).to_i : nil

    {
      id: task.id,
      task_number: task.task_number,
      name: task.name,
      start_date: task.start_date,
      end_date: task.end_date,
      required_by: task.required_by,
      all_day: true,
      status: task.status,
      progress_percentage: task.progress_percentage,
      assigned_user_id: task.assigned_user_id,
      assigned_user_name: task.assigned_user&.name,
      assigned_role: task.assigned_role,
      job_id: task.job_id,
      job_name: task.job&.display_name,
      job_code: task.job&.job_code,
      is_overdue: is_overdue,
      days_overdue: days_overdue,
      color: status_color(task.status, is_overdue),
      is_hold: task.is_on_hold?,
      hold_reason: task.hold_reason&.name,
      lock_type: task.lock_type,
      description: task.description
    }
  end

  def status_color(status, is_overdue)
    return "#EF4444" if is_overdue # Red for overdue
    case status
    when "completed" then "#22C55E"  # Green
    when "started" then "#3B82F6"    # Blue
    else "#9CA3AF"                    # Gray for not started
    end
  end

  def group_events_by_date(events, start_date, end_date)
    grouped = {}
    (start_date..end_date).each { |date| grouped[date.to_s] = [] }

    events.each do |event|
      # Add event to each date it spans
      (event[:start_date]..event[:end_date]).each do |date|
        next if date < start_date || date > end_date
        grouped[date.to_s] ||= []
        grouped[date.to_s] << event
      end
    end

    grouped
  end

  def build_meta(tasks, start_date, end_date)
    today = Date.current

    {
      total_count: tasks.count,
      overdue_count: tasks.count { |t| t.end_date < today && t.status != "completed" },
      today_count: tasks.count { |t| t.start_date <= today && t.end_date >= today },
      this_week_count: tasks.count { |t| t.end_date >= today && t.end_date <= today.end_of_week },
      date_range: { start: start_date, end: end_date }
    }
  end

  def build_user_capacity(user, tasks, absences, start_date, end_date)
    capacity_by_date = {}
    default_hours = 8.0

    (start_date..end_date).each do |date|
      # Check if it's a working day (Mon-Fri)
      next unless date.on_weekday?

      # Check for absence
      absence = absences.find { |a| a.start_date <= date && a.end_date >= date }

      if absence
        capacity_by_date[date.to_s] = {
          available_hours: 0.0,
          allocated_hours: 0.0,
          utilization_percent: 0,
          task_ids: [],
          is_absent: true,
          absence_type: absence.absence_type,
          is_overbooked: false
        }
      else
        # Count tasks on this date
        date_tasks = tasks.select { |t| t.start_date <= date && t.end_date >= date }
        task_count = date_tasks.count
        # Rough allocation: assume each task takes ~4 hours average
        allocated = task_count * 4.0

        capacity_by_date[date.to_s] = {
          available_hours: default_hours,
          allocated_hours: allocated,
          utilization_percent: ((allocated / default_hours) * 100).round,
          task_ids: date_tasks.map(&:id),
          is_absent: false,
          absence_type: nil,
          is_overbooked: allocated > default_hours
        }
      end
    end

    capacity_by_date
  end

  def build_capacity_warnings(user_data, tasks)
    overbooked_dates = []
    user_data.each do |u|
      u[:capacity_by_date].each do |date, data|
        overbooked_dates << date if data[:is_overbooked]
      end
    end

    unassigned_count = tasks.count { |t| t.assigned_user_id.nil? }

    {
      overbooked_dates: overbooked_dates.uniq,
      unassigned_tasks: unassigned_count
    }
  end
end
