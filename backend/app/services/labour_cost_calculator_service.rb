# frozen_string_literal: true

# LabourCostCalculatorService - simPRO-compatible cost calculation engine
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Implements the simPRO cost formula:
#   Total Cost = Base Labour + Employment Costs + Overhead
#   Base Labour = (Regular × Rate) + (OT1.5 × Rate × 1.5) + (OT2 × Rate × 2)
#   Employment = Base × Employment% (super, leave, workers comp)
#   Overhead = (Base + Employment) × Overhead%
#
# Australian overtime rules:
#   - First 7.6 hours at regular rate
#   - Next 2 hours at 1.5x
#   - Beyond at 2x
#
class LabourCostCalculatorService
  attr_reader :errors

  # Australian standard working hours
  REGULAR_HOURS_THRESHOLD = 7.6
  OVERTIME_1_5X_THRESHOLD = 2.0

  # Employment cost components (Australian defaults)
  EMPLOYMENT_COST_DEFAULTS = {
    superannuation: 0.115,      # 11.5% (2024 rate)
    workers_comp: 0.02,         # 2% (industry average)
    annual_leave: 0.0769,       # 4 weeks / 52 weeks
    personal_leave: 0.0384,     # 2 weeks / 52 weeks
    public_holidays: 0.0346,    # 9 days / 260 working days
    leave_loading: 0.0058       # 17.5% loading on annual leave
  }.freeze

  DEFAULT_EMPLOYMENT_COST_PERCENT = 0.285 # ~28.5% total

  def initialize(user: nil)
    @user = user
    @errors = []
  end

  # Calculate cost breakdown for a session
  # Returns detailed cost breakdown matching simPRO format
  def calculate_for_session(session)
    @errors = []

    unless session.is_a?(SitePresenceSession)
      @errors << "Invalid session"
      return nil
    end

    return nil unless session.total_hours.present? && session.total_hours.positive?

    worker = session.worker_profile
    unless worker
      @errors << "No worker profile linked to session"
      return nil
    end

    calculate_cost(
      worker_profile: worker,
      total_hours: session.total_hours,
      cost_centre: session.cost_centre,
      entry_date: session.checkin_at&.to_date
    )
  end

  # Calculate cost for a worker and hours
  def calculate_cost(worker_profile:, total_hours:, cost_centre: nil, entry_date: nil)
    @errors = []

    # Break down hours into overtime categories
    hours_breakdown = calculate_hours_breakdown(total_hours)

    # Get effective rates
    rates = get_effective_rates(worker_profile, cost_centre)

    # Calculate base labour cost
    base_labour = calculate_base_labour_cost(hours_breakdown, rates)

    # Calculate employment cost (skip for subcontractors)
    employment_cost = if worker_profile.employee?
      calculate_employment_cost(base_labour, rates[:employment_cost_percent])
    else
      0.0
    end

    # Calculate overhead allocation
    overhead_cost = calculate_overhead_cost(base_labour, employment_cost, rates[:overhead_percent])

    # Total fully-loaded cost
    total_cost = base_labour + employment_cost + overhead_cost

    {
      hours_breakdown: hours_breakdown,
      rates_used: rates,
      base_labour_cost: base_labour.round(2),
      employment_cost: employment_cost.round(2),
      overhead_cost: overhead_cost.round(2),
      total_cost: total_cost.round(2),
      cost_per_hour: (total_hours.positive? ? total_cost / total_hours : 0).round(2),
      is_employee: worker_profile.employee?,
      entry_date: entry_date
    }
  end

  # Calculate hours breakdown from total hours
  # Implements Australian overtime rules
  def calculate_hours_breakdown(total_hours)
    total = total_hours.to_f

    # First 7.6 hours at regular rate
    regular = [total, REGULAR_HOURS_THRESHOLD].min
    remaining = [total - REGULAR_HOURS_THRESHOLD, 0].max

    # Next 2 hours at 1.5x
    overtime_1_5x = [remaining, OVERTIME_1_5X_THRESHOLD].min
    overtime_2x = [remaining - OVERTIME_1_5X_THRESHOLD, 0].max

    {
      regular: regular.round(2),
      overtime_1_5x: overtime_1_5x.round(2),
      overtime_2x: overtime_2x.round(2),
      total: total.round(2)
    }
  end

  # Calculate job cost summary
  def job_cost_summary(job_id:, start_date: nil, end_date: nil)
    entries = LabourCostEntry.for_job(job_id)
    entries = entries.for_date_range(start_date, end_date) if start_date && end_date

    by_worker = entries.group_by(&:worker_profile_id)
    by_cost_centre = entries.group_by(&:cost_centre_id)

    {
      job_id: job_id,
      period: { start_date: start_date, end_date: end_date },
      totals: {
        hours: entries.sum { |e| e.total_hours || 0 }.round(2),
        base_labour: entries.sum(&:base_labour_cost).round(2),
        employment_cost: entries.sum(&:employment_cost).round(2),
        overhead: entries.sum(&:overhead_cost).round(2),
        total_cost: entries.sum(&:total_cost).round(2),
        billable_amount: entries.billable.sum { |e| e.billable_amount || 0 }.round(2),
        entry_count: entries.count
      },
      by_worker: by_worker.map do |worker_id, worker_entries|
        worker = WorkerProfile.find_by(id: worker_id)
        {
          worker_id: worker_id,
          worker_name: worker&.display_name || "Unknown",
          worker_type: worker&.worker_type,
          hours: worker_entries.sum { |e| e.total_hours || 0 }.round(2),
          cost: worker_entries.sum(&:total_cost).round(2)
        }
      end,
      by_cost_centre: by_cost_centre.compact.map do |cc_id, cc_entries|
        cc = CostCentre.find_by(id: cc_id)
        {
          cost_centre_id: cc_id,
          cost_centre_name: cc&.name || "Unallocated",
          cost_centre_code: cc&.code,
          hours: cc_entries.sum { |e| e.total_hours || 0 }.round(2),
          cost: cc_entries.sum(&:total_cost).round(2)
        }
      end
    }
  end

  # Worker productivity report (simPRO Labor Productivity Report equivalent)
  def worker_productivity_report(worker_profile_id:, start_date:, end_date:)
    worker = WorkerProfile.find(worker_profile_id)
    entries = LabourCostEntry.for_worker(worker_profile_id)
                             .for_date_range(start_date, end_date)

    total_hours = entries.sum { |e| e.total_hours || 0 }
    billable_hours = entries.billable.sum { |e| e.total_hours || 0 }
    productivity = total_hours.positive? ? (billable_hours / total_hours * 100) : 0

    # Overtime analysis
    regular_hours = entries.sum(&:regular_hours)
    ot_1_5x = entries.sum(&:overtime_1_5x_hours)
    ot_2x = entries.sum(&:overtime_2x_hours)

    {
      worker: {
        id: worker.id,
        name: worker.display_name,
        type: worker.worker_type,
        hourly_rate: worker.effective_hourly_rate&.to_f
      },
      period: { start_date: start_date, end_date: end_date },
      hours: {
        total: total_hours.round(2),
        regular: regular_hours.to_f.round(2),
        overtime_1_5x: ot_1_5x.to_f.round(2),
        overtime_2x: ot_2x.to_f.round(2),
        billable: billable_hours.round(2),
        non_billable: (total_hours - billable_hours).round(2)
      },
      productivity: {
        percent: productivity.round(1),
        target: 85.0, # Industry benchmark
        variance: (productivity - 85.0).round(1)
      },
      costs: {
        base_labour: entries.sum(&:base_labour_cost).to_f.round(2),
        employment: entries.sum(&:employment_cost).to_f.round(2),
        overhead: entries.sum(&:overhead_cost).to_f.round(2),
        total: entries.sum(&:total_cost).to_f.round(2)
      },
      billing: {
        billable_amount: entries.billable.sum { |e| e.billable_amount || 0 }.round(2),
        unbilled_count: entries.unbilled.count,
        invoiced_count: entries.where(billing_status: "invoiced").count
      },
      days_worked: entries.select(:entry_date).distinct.count
    }
  end

  # Cost centre P&L report
  def cost_centre_pnl(cost_centre_id:, start_date:, end_date:)
    cc = CostCentre.find(cost_centre_id)
    entries = LabourCostEntry.for_cost_centre(cost_centre_id)
                             .for_date_range(start_date, end_date)

    by_worker_type = entries.group_by { |e| e.worker_profile&.worker_type }

    {
      cost_centre: {
        id: cc.id,
        code: cc.code,
        name: cc.name,
        type: cc.centre_type,
        overhead_percent: cc.total_overhead_percent
      },
      period: { start_date: start_date, end_date: end_date },
      labour_costs: {
        employee: (by_worker_type["employee"] || []).sum(&:total_cost).round(2),
        subcontractor: (by_worker_type["subcontractor"] || []).sum(&:total_cost).round(2),
        total: entries.sum(&:total_cost).round(2)
      },
      hours: {
        employee: (by_worker_type["employee"] || []).sum { |e| e.total_hours || 0 }.round(2),
        subcontractor: (by_worker_type["subcontractor"] || []).sum { |e| e.total_hours || 0 }.round(2),
        total: entries.sum { |e| e.total_hours || 0 }.round(2)
      },
      cost_breakdown: {
        base_labour: entries.sum(&:base_labour_cost).to_f.round(2),
        employment_loading: entries.sum(&:employment_cost).to_f.round(2),
        overhead_allocation: entries.sum(&:overhead_cost).to_f.round(2)
      },
      budget_vs_actual: cc.budget_amount.present? ? {
        budget: cc.budget_amount.to_f,
        actual: entries.sum(&:total_cost).round(2),
        variance: (cc.budget_amount - entries.sum(&:total_cost)).round(2),
        variance_percent: (entries.sum(&:total_cost) / cc.budget_amount * 100).round(1)
      } : nil
    }
  end

  # Distribute costs across multiple workers on a job (ratio-based)
  def distribute_job_costs(job_id:, total_to_distribute:, allocation_method: :hours)
    sessions = SitePresenceSession.where(job_id: job_id).completed

    return { success: false, error: "No completed sessions" } if sessions.empty?

    case allocation_method
    when :hours
      total_hours = sessions.sum { |s| s.total_hours || 0 }
      return { success: false, error: "No hours recorded" } if total_hours.zero?

      allocations = sessions.group_by(&:worker_profile_id).map do |worker_id, worker_sessions|
        worker_hours = worker_sessions.sum { |s| s.total_hours || 0 }
        ratio = worker_hours / total_hours
        {
          worker_profile_id: worker_id,
          hours: worker_hours.round(2),
          ratio: ratio.round(4),
          amount: (total_to_distribute * ratio).round(2)
        }
      end
    when :equal
      worker_count = sessions.map(&:worker_profile_id).uniq.count
      amount_each = total_to_distribute / worker_count

      allocations = sessions.group_by(&:worker_profile_id).map do |worker_id, _|
        {
          worker_profile_id: worker_id,
          ratio: (1.0 / worker_count).round(4),
          amount: amount_each.round(2)
        }
      end
    else
      return { success: false, error: "Invalid allocation method" }
    end

    { success: true, job_id: job_id, total_distributed: total_to_distribute, allocations: allocations }
  end

  # Bulk create cost entries from sessions
  def process_pending_sessions(job_id: nil, date: nil)
    scope = SitePresenceSession.completed.where(labour_cost_entry_id: nil)
    scope = scope.where(job_id: job_id) if job_id
    scope = scope.where("DATE(checkin_at) = ?", date) if date

    results = { success: 0, failed: 0, errors: [] }

    scope.find_each do |session|
      entry = LabourCostEntry.create_from_session(session)
      if entry&.persisted?
        session.update!(labour_cost_entry_id: entry.id)
        results[:success] += 1
      else
        results[:failed] += 1
        results[:errors] << { session_id: session.id, error: entry&.errors&.full_messages }
      end
    rescue StandardError => e
      results[:failed] += 1
      results[:errors] << { session_id: session.id, error: e.message }
    end

    results
  end

  private

  def get_effective_rates(worker_profile, cost_centre)
    cc = cost_centre || worker_profile.cost_centre

    {
      hourly_rate: worker_profile.effective_hourly_rate || 0,
      overtime_1_5x_rate: worker_profile.effective_overtime_1_5x_rate || 0,
      overtime_2x_rate: worker_profile.effective_overtime_2x_rate || 0,
      employment_cost_percent: worker_profile.employment_cost_decimal * 100,
      overhead_percent: cc&.total_overhead_percent || 0
    }
  end

  def calculate_base_labour_cost(hours, rates)
    regular_cost = (hours[:regular] || 0) * (rates[:hourly_rate] || 0)
    ot_1_5x_cost = (hours[:overtime_1_5x] || 0) * (rates[:overtime_1_5x_rate] || 0)
    ot_2x_cost = (hours[:overtime_2x] || 0) * (rates[:overtime_2x_rate] || 0)

    regular_cost + ot_1_5x_cost + ot_2x_cost
  end

  def calculate_employment_cost(base_labour, employment_percent)
    base_labour * (employment_percent / 100.0)
  end

  def calculate_overhead_cost(base_labour, employment_cost, overhead_percent)
    (base_labour + employment_cost) * (overhead_percent / 100.0)
  end
end
