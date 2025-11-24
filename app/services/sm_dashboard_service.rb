# frozen_string_literal: true

# SmDashboardService - Dashboard data aggregation for SM Gantt Phase 2
#
# Provides:
# - Project progress summaries
# - Resource utilization metrics
# - Cost tracking & variance analysis
# - Timeline health indicators
#
class SmDashboardService
  def initialize(construction_id: nil)
    @construction_id = construction_id
  end

  # Overall project health dashboard
  def project_summary
    tasks = base_tasks

    total = tasks.count
    completed = tasks.completed.count
    in_progress = tasks.started.count
    not_started = tasks.not_started.count
    on_hold = tasks.where(is_hold_task: true).where.not(status: 'completed').count

    # Calculate schedule health
    overdue = tasks.where('end_date < ? AND status != ?', Date.current, 'completed').count
    due_this_week = tasks.where(end_date: Date.current..(Date.current + 7.days)).where.not(status: 'completed').count

    {
      task_counts: {
        total: total,
        completed: completed,
        in_progress: in_progress,
        not_started: not_started,
        on_hold: on_hold
      },
      progress: {
        percentage: total > 0 ? ((completed.to_f / total) * 100).round(1) : 0,
        completed: completed,
        remaining: total - completed
      },
      schedule_health: {
        overdue: overdue,
        due_this_week: due_this_week,
        health_score: calculate_health_score(overdue, total)
      },
      timeline: {
        earliest_start: tasks.minimum(:start_date),
        latest_end: tasks.maximum(:end_date),
        days_remaining: tasks.where.not(status: 'completed').maximum(:end_date)&.then { |d| (d - Date.current).to_i }
      }
    }
  end

  # Resource utilization summary
  def resource_utilization(start_date: nil, end_date: nil)
    start_date ||= Date.current.beginning_of_week
    end_date ||= start_date + 4.weeks

    resources = SmResource.active.includes(:resource_allocations, :time_entries)
    working_days = calculate_working_days(start_date, end_date)

    by_type = { person: [], equipment: [], material: [] }
    totals = { capacity: 0, allocated: 0, logged: 0 }

    resources.each do |resource|
      capacity = working_days * (resource.availability_hours_per_day || 8.0)
      allocated = resource.resource_allocations
        .where(allocation_date: start_date..end_date)
        .sum(:allocated_hours).to_f
      logged = resource.time_entries
        .where(entry_date: start_date..end_date)
        .sum(:total_hours).to_f

      utilization = capacity > 0 ? (allocated / capacity * 100).round(1) : 0
      efficiency = allocated > 0 ? (logged / allocated * 100).round(1) : 0

      resource_data = {
        id: resource.id,
        name: resource.name,
        type: resource.resource_type,
        trade: resource.trade,
        capacity: capacity.round(1),
        allocated: allocated.round(1),
        logged: logged.round(1),
        utilization: utilization,
        efficiency: efficiency,
        status: utilization_status(utilization)
      }

      type_key = resource.resource_type.to_sym
      by_type[type_key] << resource_data if by_type.key?(type_key)

      totals[:capacity] += capacity
      totals[:allocated] += allocated
      totals[:logged] += logged
    end

    {
      period: { start_date: start_date, end_date: end_date, working_days: working_days },
      totals: {
        capacity: totals[:capacity].round(1),
        allocated: totals[:allocated].round(1),
        logged: totals[:logged].round(1),
        utilization: totals[:capacity] > 0 ? (totals[:allocated] / totals[:capacity] * 100).round(1) : 0,
        efficiency: totals[:allocated] > 0 ? (totals[:logged] / totals[:allocated] * 100).round(1) : 0
      },
      by_type: {
        people: aggregate_type_stats(by_type[:person]),
        equipment: aggregate_type_stats(by_type[:equipment]),
        materials: aggregate_type_stats(by_type[:material])
      },
      resources: by_type.values.flatten,
      alerts: utilization_alerts(by_type.values.flatten)
    }
  end

  # Cost tracking summary
  def cost_summary(start_date: nil, end_date: nil)
    start_date ||= Date.current.beginning_of_month
    end_date ||= Date.current.end_of_month

    time_entries = SmTimeEntry.includes(:resource, :task)
      .where(entry_date: start_date..end_date)
      .approved

    time_entries = time_entries.joins(:task).where(sm_tasks: { construction_id: @construction_id }) if @construction_id

    # Calculate labor costs
    labor_cost = 0
    by_resource_type = { person: 0, equipment: 0, material: 0 }
    by_trade = {}
    by_task = {}

    time_entries.each do |entry|
      rate = entry.resource.hourly_rate || 0
      multiplier = entry.entry_type == 'overtime' ? 1.5 : 1.0
      cost = entry.total_hours * rate * multiplier

      labor_cost += cost

      # By resource type
      type_key = entry.resource.resource_type.to_sym
      by_resource_type[type_key] = (by_resource_type[type_key] || 0) + cost

      # By trade
      trade = entry.resource.trade || 'Other'
      by_trade[trade] = (by_trade[trade] || 0) + cost

      # By task
      task_name = entry.task.name
      by_task[task_name] ||= { hours: 0, cost: 0 }
      by_task[task_name][:hours] += entry.total_hours
      by_task[task_name][:cost] += cost
    end

    # Get budget if available (from tasks or project)
    budget = calculate_budget

    {
      period: { start_date: start_date, end_date: end_date },
      summary: {
        total_cost: labor_cost.round(2),
        budget: budget,
        variance: budget ? (budget - labor_cost).round(2) : nil,
        variance_percent: budget && budget > 0 ? ((budget - labor_cost) / budget * 100).round(1) : nil
      },
      by_resource_type: by_resource_type.transform_values { |v| v.round(2) },
      by_trade: by_trade.transform_values { |v| v.round(2) }.sort_by { |_, v| -v }.to_h,
      top_tasks: by_task.sort_by { |_, v| -v[:cost] }.first(10).map do |name, data|
        { task_name: name, hours: data[:hours].round(1), cost: data[:cost].round(2) }
      end,
      hours_summary: {
        total: time_entries.sum(:total_hours).round(1),
        regular: time_entries.regular.sum(:total_hours).round(1),
        overtime: time_entries.overtime.sum(:total_hours).round(1)
      }
    }
  end

  # Weekly trend data for charts
  def weekly_trends(weeks: 8)
    end_date = Date.current.end_of_week
    start_date = end_date - (weeks - 1).weeks

    weeks_data = []
    current_week = start_date.beginning_of_week

    while current_week <= end_date
      week_end = current_week.end_of_week

      # Task completion for this week
      tasks = base_tasks
      completed_this_week = tasks.where(completed_at: current_week..week_end).count

      # Hours logged this week
      entries = SmTimeEntry.where(entry_date: current_week..week_end)
      entries = entries.joins(:task).where(sm_tasks: { construction_id: @construction_id }) if @construction_id

      hours_logged = entries.sum(:total_hours).to_f
      hours_approved = entries.approved.sum(:total_hours).to_f

      # Resource allocation
      allocations = SmResourceAllocation.where(allocation_date: current_week..week_end)
      allocations = allocations.joins(:task).where(sm_tasks: { construction_id: @construction_id }) if @construction_id
      hours_allocated = allocations.sum(:allocated_hours).to_f

      weeks_data << {
        week_start: current_week,
        week_label: current_week.strftime('%b %d'),
        tasks_completed: completed_this_week,
        hours_logged: hours_logged.round(1),
        hours_approved: hours_approved.round(1),
        hours_allocated: hours_allocated.round(1),
        efficiency: hours_allocated > 0 ? (hours_logged / hours_allocated * 100).round(1) : 0
      }

      current_week += 1.week
    end

    weeks_data
  end

  # Upcoming work forecast
  def upcoming_forecast(days: 14)
    start_date = Date.current
    end_date = start_date + days.days

    tasks = base_tasks
      .where(start_date: start_date..end_date)
      .where.not(status: 'completed')
      .includes(:supplier, :assigned_user)
      .order(:start_date)

    allocations = SmResourceAllocation
      .includes(:resource, :task)
      .where(allocation_date: start_date..end_date)
      .where(status: %w[planned confirmed])

    allocations = allocations.joins(:task).where(sm_tasks: { construction_id: @construction_id }) if @construction_id

    # Group by date
    by_date = (start_date..end_date).map do |date|
      day_tasks = tasks.select { |t| t.start_date == date }
      day_allocations = allocations.select { |a| a.allocation_date == date }

      {
        date: date,
        day_name: date.strftime('%A'),
        is_weekend: date.saturday? || date.sunday?,
        tasks_starting: day_tasks.count,
        tasks: day_tasks.map { |t| { id: t.id, name: t.name, trade: t.trade } },
        allocated_hours: day_allocations.sum(&:allocated_hours).to_f,
        resources_needed: day_allocations.map(&:resource_id).uniq.count
      }
    end

    {
      period: { start_date: start_date, end_date: end_date },
      summary: {
        total_tasks_starting: tasks.count,
        total_allocated_hours: allocations.sum(:allocated_hours).to_f.round(1),
        resources_involved: allocations.map(&:resource_id).uniq.count
      },
      days: by_date
    }
  end

  # Trade breakdown
  def trade_breakdown
    tasks = base_tasks.where.not(trade: nil)

    tasks.group(:trade).count.map do |trade, count|
      completed = tasks.where(trade: trade).completed.count
      {
        trade: trade,
        total: count,
        completed: completed,
        in_progress: tasks.where(trade: trade).started.count,
        pending: tasks.where(trade: trade).not_started.count,
        progress: count > 0 ? (completed.to_f / count * 100).round(1) : 0
      }
    end.sort_by { |t| -t[:total] }
  end

  private

  def base_tasks
    scope = SmTask
    scope = scope.where(construction_id: @construction_id) if @construction_id
    scope
  end

  def calculate_health_score(overdue, total)
    return 100 if total == 0
    overdue_ratio = overdue.to_f / total
    score = ((1 - overdue_ratio) * 100).round(0)
    [score, 0].max
  end

  def calculate_working_days(start_date, end_date)
    calculator = WorkingDaysCalculator.new
    calculator.working_days_between(start_date, end_date)
  rescue StandardError
    (start_date..end_date).count { |d| (1..5).cover?(d.wday) }
  end

  def utilization_status(percent)
    case percent
    when 0..50 then 'under'
    when 50..80 then 'optimal'
    when 80..100 then 'high'
    else 'over'
    end
  end

  def aggregate_type_stats(resources)
    return { count: 0, capacity: 0, allocated: 0, utilization: 0 } if resources.empty?

    {
      count: resources.count,
      capacity: resources.sum { |r| r[:capacity] }.round(1),
      allocated: resources.sum { |r| r[:allocated] }.round(1),
      logged: resources.sum { |r| r[:logged] }.round(1),
      utilization: (resources.sum { |r| r[:allocated] } / resources.sum { |r| r[:capacity] } * 100).round(1)
    }
  end

  def utilization_alerts(resources)
    alerts = []

    over_allocated = resources.select { |r| r[:utilization] > 100 }
    under_utilized = resources.select { |r| r[:utilization] < 30 && r[:capacity] > 0 }

    over_allocated.each do |r|
      alerts << {
        type: 'over_allocated',
        severity: 'warning',
        resource_id: r[:id],
        resource_name: r[:name],
        message: "#{r[:name]} is #{r[:utilization].round(0)}% allocated"
      }
    end

    under_utilized.each do |r|
      alerts << {
        type: 'under_utilized',
        severity: 'info',
        resource_id: r[:id],
        resource_name: r[:name],
        message: "#{r[:name]} is only #{r[:utilization].round(0)}% utilized"
      }
    end

    alerts
  end

  def calculate_budget
    # Try to get budget from construction or project settings
    if @construction_id
      construction = Construction.find_by(id: @construction_id)
      return construction.labor_budget if construction&.respond_to?(:labor_budget)
    end
    nil
  end
end
