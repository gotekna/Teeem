# frozen_string_literal: true

# SmEvmService - Earned Value Management calculations
#
# Key metrics:
# - PV (Planned Value) - Budgeted cost of work scheduled
# - EV (Earned Value) - Budgeted cost of work performed
# - AC (Actual Cost) - Actual cost of work performed
# - SV (Schedule Variance) = EV - PV
# - CV (Cost Variance) = EV - AC
# - SPI (Schedule Performance Index) = EV / PV
# - CPI (Cost Performance Index) = EV / AC
# - EAC (Estimate at Completion)
# - ETC (Estimate to Complete)
# - VAC (Variance at Completion)
#
class SmEvmService
  attr_reader :construction, :as_of_date

  def initialize(construction, as_of_date: Date.current)
    @construction = construction
    @as_of_date = as_of_date
  end

  def calculate
    tasks = construction.sm_tasks.includes(:time_entries, :resource_allocations)

    # Calculate core values
    pv = calculate_planned_value(tasks)
    ev = calculate_earned_value(tasks)
    ac = calculate_actual_cost(tasks)
    bac = calculate_budget_at_completion(tasks)

    # Derived metrics
    sv = ev - pv
    cv = ev - ac
    spi = pv > 0 ? (ev.to_f / pv).round(3) : 0
    cpi = ac > 0 ? (ev.to_f / ac).round(3) : 0

    # Forecasts
    eac = calculate_eac(bac, cpi, ac, ev)
    etc = eac - ac
    vac = bac - eac

    # Percent complete
    percent_complete = bac > 0 ? ((ev.to_f / bac) * 100).round(1) : 0
    percent_spent = bac > 0 ? ((ac.to_f / bac) * 100).round(1) : 0

    {
      as_of_date: as_of_date,
      core_values: {
        pv: pv.round(2),
        ev: ev.round(2),
        ac: ac.round(2),
        bac: bac.round(2)
      },
      variances: {
        sv: sv.round(2),
        cv: cv.round(2),
        sv_percent: pv > 0 ? ((sv / pv) * 100).round(1) : 0,
        cv_percent: ev > 0 ? ((cv / ev) * 100).round(1) : 0
      },
      indices: {
        spi: spi,
        cpi: cpi,
        spi_status: index_status(spi),
        cpi_status: index_status(cpi)
      },
      forecasts: {
        eac: eac.round(2),
        etc: etc.round(2),
        vac: vac.round(2),
        tcpi: calculate_tcpi(bac, ev, ac)
      },
      progress: {
        percent_complete: percent_complete,
        percent_spent: percent_spent,
        schedule_status: schedule_status(spi),
        cost_status: cost_status(cpi)
      },
      health: overall_health(spi, cpi),
      by_trade: calculate_by_trade(tasks)
    }
  end

  # S-curve data for charts
  def s_curve_data
    tasks = construction.sm_tasks.order(:start_date)
    return [] if tasks.empty?

    start_date = tasks.minimum(:start_date)
    end_date = [tasks.maximum(:end_date), as_of_date].max

    data = []
    (start_date..end_date).each do |date|
      pv = calculate_planned_value_at(tasks, date)
      ev = calculate_earned_value_at(tasks, date)
      ac = calculate_actual_cost_at(tasks, date)

      data << {
        date: date,
        planned_value: pv.round(2),
        earned_value: ev.round(2),
        actual_cost: ac.round(2)
      }
    end

    data
  end

  private

  # Planned Value: Sum of budgeted costs for tasks that should be complete by as_of_date
  def calculate_planned_value(tasks)
    tasks.sum do |task|
      if task.end_date && task.end_date <= as_of_date
        task.estimated_cost || 0
      elsif task.start_date && task.start_date <= as_of_date && task.end_date && task.end_date > as_of_date
        # Partially through task - prorate
        total_days = (task.end_date - task.start_date).to_i
        days_elapsed = (as_of_date - task.start_date).to_i
        ratio = total_days > 0 ? days_elapsed.to_f / total_days : 0
        (task.estimated_cost || 0) * ratio
      else
        0
      end
    end
  end

  # Earned Value: Sum of budgeted costs for work actually completed
  def calculate_earned_value(tasks)
    tasks.sum do |task|
      cost = task.estimated_cost || 0
      case task.status
      when 'completed'
        cost
      when 'started'
        # Use percent complete if available, otherwise estimate 50%
        percent = task.percent_complete || 50
        cost * (percent / 100.0)
      else
        0
      end
    end
  end

  # Actual Cost: Sum of actual costs incurred
  def calculate_actual_cost(tasks)
    tasks.sum do |task|
      # Sum from time entries
      time_cost = task.time_entries.sum do |entry|
        hours = entry.hours || 0
        rate = entry.resource&.hourly_rate || 0
        hours * rate
      end

      # Add any direct costs
      direct_cost = task.actual_cost || 0

      time_cost + direct_cost
    end
  end

  # Budget at Completion: Total planned budget
  def calculate_budget_at_completion(tasks)
    tasks.sum { |t| t.estimated_cost || 0 }
  end

  # Estimate at Completion
  def calculate_eac(bac, cpi, ac, ev)
    return bac if cpi == 0

    # EAC = AC + (BAC - EV) / CPI
    # This assumes future work will be performed at current efficiency
    ac + ((bac - ev) / cpi)
  end

  # To Complete Performance Index
  def calculate_tcpi(bac, ev, ac)
    remaining_work = bac - ev
    remaining_budget = bac - ac
    return 0 if remaining_budget <= 0

    (remaining_work / remaining_budget).round(3)
  end

  # Calculate PV at a specific date
  def calculate_planned_value_at(tasks, date)
    tasks.sum do |task|
      if task.end_date && task.end_date <= date
        task.estimated_cost || 0
      elsif task.start_date && task.start_date <= date && task.end_date && task.end_date > date
        total_days = (task.end_date - task.start_date).to_i
        days_elapsed = (date - task.start_date).to_i
        ratio = total_days > 0 ? days_elapsed.to_f / total_days : 0
        (task.estimated_cost || 0) * ratio
      else
        0
      end
    end
  end

  # Calculate EV at a specific date
  def calculate_earned_value_at(tasks, date)
    tasks.sum do |task|
      next 0 unless task.completed_at && task.completed_at.to_date <= date

      task.estimated_cost || 0
    end
  end

  # Calculate AC at a specific date
  def calculate_actual_cost_at(tasks, date)
    tasks.sum do |task|
      task.time_entries.where('work_date <= ?', date).sum do |entry|
        hours = entry.hours || 0
        rate = entry.resource&.hourly_rate || 0
        hours * rate
      end
    end
  end

  # Calculate metrics by trade
  def calculate_by_trade(tasks)
    tasks.group_by(&:trade).transform_values do |trade_tasks|
      pv = calculate_planned_value(trade_tasks)
      ev = calculate_earned_value(trade_tasks)
      ac = calculate_actual_cost(trade_tasks)

      {
        task_count: trade_tasks.size,
        pv: pv.round(2),
        ev: ev.round(2),
        ac: ac.round(2),
        spi: pv > 0 ? (ev / pv).round(3) : 0,
        cpi: ac > 0 ? (ev / ac).round(3) : 0
      }
    end
  end

  def index_status(index)
    if index >= 1.0
      'on_track'
    elsif index >= 0.9
      'slight_variance'
    elsif index >= 0.8
      'moderate_variance'
    else
      'significant_variance'
    end
  end

  def schedule_status(spi)
    if spi >= 1.0
      'ahead_of_schedule'
    elsif spi >= 0.95
      'on_schedule'
    elsif spi >= 0.85
      'slightly_behind'
    else
      'behind_schedule'
    end
  end

  def cost_status(cpi)
    if cpi >= 1.0
      'under_budget'
    elsif cpi >= 0.95
      'on_budget'
    elsif cpi >= 0.85
      'slightly_over'
    else
      'over_budget'
    end
  end

  def overall_health(spi, cpi)
    avg = (spi + cpi) / 2.0
    if avg >= 1.0
      'excellent'
    elsif avg >= 0.9
      'good'
    elsif avg >= 0.8
      'fair'
    else
      'poor'
    end
  end

  class << self
    def calculate(construction, as_of_date: Date.current)
      new(construction, as_of_date: as_of_date).calculate
    end

    def s_curve(construction, as_of_date: Date.current)
      new(construction, as_of_date: as_of_date).s_curve_data
    end
  end
end
