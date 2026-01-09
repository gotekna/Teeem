# frozen_string_literal: true

# SitePresenceDashboardsController - Dashboard endpoints for Site Presence system
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Provides aggregated data for admin dashboards:
# - Who's on site now
# - Daily/weekly activity summaries
# - Cost analysis
# - Anomaly alerts
# - Productivity metrics
#
class Api::V1::SitePresenceDashboardsController < ApplicationController
  # GET /api/v1/site_presence_dashboards/overview
  # Main dashboard overview with key metrics
  def overview
    today = Date.current
    this_week_start = today.beginning_of_week
    this_month_start = today.beginning_of_month

    render json: {
      success: true,
      data: {
        live: live_status,
        today: daily_summary(today),
        this_week: period_summary(this_week_start, today),
        this_month: period_summary(this_month_start, today),
        alerts: current_alerts,
        generated_at: Time.current
      }
    }
  end

  # GET /api/v1/site_presence_dashboards/live
  # Who's currently on site
  def live
    active_sessions = SitePresenceSession.active
                                         .includes(:worker_profile, :job)
                                         .order(:checkin_at)

    render json: {
      success: true,
      data: {
        active_count: active_sessions.count,
        sessions: active_sessions.map { |s| live_session_json(s) },
        by_job: active_sessions.group_by(&:job_id).map do |job_id, sessions|
          job = sessions.first.job
          {
            job_id: job_id,
            job_name: job&.name,
            job_number: job&.job_number,
            worker_count: sessions.count,
            workers: sessions.map { |s| s.worker_profile&.display_name }
          }
        end
      }
    }
  end

  # GET /api/v1/site_presence_dashboards/daily_activity
  # Activity breakdown for a specific date
  def daily_activity
    date = params[:date]&.to_date || Date.current

    sessions = SitePresenceSession.where("DATE(checkin_at) = ?", date)
                                  .includes(:worker_profile, :job, :labour_cost_entry)

    entries = LabourCostEntry.for_date(date).includes(:worker_profile, :job)

    render json: {
      success: true,
      data: {
        date: date,
        sessions: {
          total: sessions.count,
          completed: sessions.completed.count,
          active: sessions.active.count,
          pending_approval: sessions.pending.count,
          with_anomalies: sessions.where(has_anomalies: true).count
        },
        hours: {
          total: sessions.completed.sum { |s| s.total_hours || 0 }.round(2),
          regular: entries.sum(&:regular_hours).to_f.round(2),
          overtime_1_5x: entries.sum(&:overtime_1_5x_hours).to_f.round(2),
          overtime_2x: entries.sum(&:overtime_2x_hours).to_f.round(2)
        },
        costs: {
          base_labour: entries.sum(&:base_labour_cost).to_f.round(2),
          employment: entries.sum(&:employment_cost).to_f.round(2),
          overhead: entries.sum(&:overhead_cost).to_f.round(2),
          total: entries.sum(&:total_cost).to_f.round(2)
        },
        by_job: sessions.group_by(&:job_id).map do |job_id, job_sessions|
          job = job_sessions.first.job
          job_entries = entries.select { |e| e.job_id == job_id }
          {
            job_id: job_id,
            job_name: job&.name,
            session_count: job_sessions.count,
            hours: job_sessions.sum { |s| s.total_hours || 0 }.round(2),
            cost: job_entries.sum(&:total_cost).to_f.round(2)
          }
        end,
        timeline: build_timeline(sessions)
      }
    }
  end

  # GET /api/v1/site_presence_dashboards/job_profitability
  # Job profitability analysis
  def job_profitability
    budgets = JobCostBudget.includes(:job)
                           .where.not(total_budget: nil)
                           .order(:total_variance_percent)

    render json: {
      success: true,
      data: {
        summary: {
          total_jobs: budgets.count,
          over_budget: budgets.over_budget.count,
          over_warning: budgets.over_warning.count,
          over_critical: budgets.over_critical.count,
          healthy: budgets.where("total_variance_percent < warning_threshold_percent").count
        },
        jobs: budgets.limit(50).map do |budget|
          {
            job_id: budget.job_id,
            job_name: budget.job&.name,
            job_number: budget.job&.job_number,
            budget: budget.total_budget&.to_f || 0,
            actual: budget.total_actual&.to_f || 0,
            variance_percent: budget.total_variance_percent,
            status: budget.status,
            labour_variance: budget.labour_variance_percent
          }
        end
      }
    }
  end

  # GET /api/v1/site_presence_dashboards/worker_productivity
  # Worker productivity metrics
  def worker_productivity
    days = (params[:days] || 30).to_i
    start_date = days.days.ago.to_date

    workers = WorkerProfile.active.includes(:labour_cost_entries, :site_presence_sessions)

    render json: {
      success: true,
      data: {
        period: "Last #{days} days",
        workers: workers.map do |worker|
          entries = worker.labour_cost_entries.where("entry_date >= ?", start_date)
          sessions = worker.site_presence_sessions.where("checkin_at >= ?", start_date)

          total_hours = entries.sum { |e| e.total_hours || 0 }
          billable_hours = entries.billable.sum { |e| e.total_hours || 0 }

          {
            worker_id: worker.id,
            name: worker.display_name,
            type: worker.worker_type,
            sessions: sessions.count,
            hours: total_hours.round(2),
            billable_hours: billable_hours.round(2),
            productivity_percent: total_hours.positive? ? (billable_hours / total_hours * 100).round(1) : 0,
            total_cost: entries.sum(&:total_cost).to_f.round(2),
            avg_hours_per_session: sessions.completed.count.positive? ? (total_hours / sessions.completed.count).round(2) : 0
          }
        end.sort_by { |w| -w[:hours] }
      }
    }
  end

  # GET /api/v1/site_presence_dashboards/cost_centre_breakdown
  # Cost breakdown by cost centre
  def cost_centre_breakdown
    days = (params[:days] || 30).to_i
    start_date = days.days.ago.to_date

    cost_centres = CostCentre.active.includes(:labour_cost_entries)

    render json: {
      success: true,
      data: {
        period: "Last #{days} days",
        cost_centres: cost_centres.map do |cc|
          entries = cc.labour_cost_entries.where("entry_date >= ?", start_date)

          {
            id: cc.id,
            code: cc.code,
            name: cc.name,
            type: cc.centre_type,
            hours: entries.sum { |e| e.total_hours || 0 }.round(2),
            cost: entries.sum(&:total_cost).to_f.round(2),
            budget: cc.budget_amount&.to_f,
            overhead_percent: cc.total_overhead_percent
          }
        end.sort_by { |c| -c[:cost] }
      }
    }
  end

  # GET /api/v1/site_presence_dashboards/anomaly_summary
  # Anomaly detection summary
  def anomaly_summary
    service = AnomalyDetectionService.new
    summary = service.dashboard_summary(days: (params[:days] || 7).to_i)

    render json: {
      success: true,
      data: summary
    }
  end

  # GET /api/v1/site_presence_dashboards/pending_approvals
  # Sessions pending approval
  def pending_approvals
    sessions = SitePresenceSession.pending
                                  .includes(:worker_profile, :job)
                                  .order(checkin_at: :desc)
                                  .limit(50)

    render json: {
      success: true,
      data: {
        count: SitePresenceSession.pending.count,
        sessions: sessions.map { |s| approval_session_json(s) }
      }
    }
  end

  # GET /api/v1/site_presence_dashboards/ai_suggestions_summary
  # AI timesheet suggestions summary
  def ai_suggestions_summary
    pending = AiTimesheetSuggestion.pending
    recent_accepted = AiTimesheetSuggestion.accepted.where("accepted_at > ?", 7.days.ago)
    recent_rejected = AiTimesheetSuggestion.rejected.where("rejected_at > ?", 7.days.ago)

    render json: {
      success: true,
      data: {
        pending: {
          count: pending.count,
          total_hours: pending.sum(&:suggested_hours).round(2),
          high_confidence: pending.high_confidence.count,
          by_worker: pending.group(:worker_profile_id).count
        },
        last_7_days: {
          accepted: recent_accepted.count,
          rejected: recent_rejected.count,
          acceptance_rate: calculate_rate(recent_accepted.count, recent_accepted.count + recent_rejected.count)
        },
        top_pending: pending.order(confidence_score: :desc).limit(10).map do |s|
          {
            id: s.id,
            worker: s.worker_profile&.display_name,
            job: s.job&.name,
            date: s.suggestion_date,
            hours: s.suggested_hours,
            confidence: s.confidence_score
          }
        end
      }
    }
  end

  private

  def live_status
    active = SitePresenceSession.active.count
    {
      active_sessions: active,
      active_workers: SitePresenceSession.active.select(:worker_profile_id).distinct.count,
      active_jobs: SitePresenceSession.active.select(:job_id).distinct.count
    }
  end

  def daily_summary(date)
    sessions = SitePresenceSession.where("DATE(checkin_at) = ?", date)
    entries = LabourCostEntry.for_date(date)

    {
      sessions: sessions.count,
      completed: sessions.completed.count,
      hours: entries.sum { |e| e.total_hours || 0 }.round(2),
      cost: entries.sum(&:total_cost).to_f.round(2),
      anomalies: sessions.where(has_anomalies: true).count
    }
  end

  def period_summary(start_date, end_date)
    sessions = SitePresenceSession.where(checkin_at: start_date.beginning_of_day..end_date.end_of_day)
    entries = LabourCostEntry.for_date_range(start_date, end_date)

    {
      sessions: sessions.count,
      hours: entries.sum { |e| e.total_hours || 0 }.round(2),
      cost: entries.sum(&:total_cost).to_f.round(2),
      avg_hours_per_day: calculate_avg_per_day(entries, start_date, end_date)
    }
  end

  def current_alerts
    {
      pending_approvals: SitePresenceSession.pending.count,
      anomalies_today: SitePresenceSession.where("DATE(checkin_at) = ?", Date.current).where(has_anomalies: true).count,
      over_budget_jobs: JobCostBudget.over_budget.count,
      ai_suggestions_pending: AiTimesheetSuggestion.pending.count
    }
  end

  def live_session_json(session)
    duration = session.checkin_at ? ((Time.current - session.checkin_at) / 1.hour).round(2) : 0

    {
      id: session.id,
      worker: {
        id: session.worker_profile_id,
        name: session.worker_profile&.display_name,
        photo: session.worker_profile&.profile_photo_url
      },
      job: {
        id: session.job_id,
        name: session.job&.name,
        number: session.job&.job_number
      },
      checkin_at: session.checkin_at,
      duration_hours: duration,
      gps_verified: session.gps_verified_checkin,
      face_verified: session.face_verified_checkin
    }
  end

  def approval_session_json(session)
    {
      id: session.id,
      worker: session.worker_profile&.display_name,
      job: session.job&.name,
      date: session.checkin_at&.to_date,
      hours: session.total_hours,
      has_anomalies: session.has_anomalies,
      anomaly_types: session.anomaly_details&.keys,
      checkin_photo: session.checkin_photo_id.present?,
      checkout_photo: session.checkout_photo_id.present?,
      face_verified: session.face_verified_checkin && session.face_verified_checkout
    }
  end

  def build_timeline(sessions)
    # Group by hour for timeline chart
    sessions.group_by { |s| s.checkin_at&.hour }.map do |hour, hour_sessions|
      {
        hour: hour,
        checkins: hour_sessions.count,
        checkouts: sessions.select { |s| s.checkout_at&.hour == hour }.count
      }
    end.sort_by { |t| t[:hour] || 0 }
  end

  def calculate_avg_per_day(entries, start_date, end_date)
    days = (end_date - start_date).to_i + 1
    return 0 if days <= 0

    total_hours = entries.sum { |e| e.total_hours || 0 }
    (total_hours / days).round(2)
  end

  def calculate_rate(numerator, denominator)
    return 0 if denominator.zero?

    ((numerator.to_f / denominator) * 100).round(1)
  end
end
