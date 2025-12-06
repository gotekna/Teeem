# Historical snapshot of job metrics for trend analysis
# Unlike materialized views (current state), this table preserves history
# One row per job per day
class FactJobDailySnapshot < ApplicationRecord
  belongs_to :job

  # Scopes
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :for_date, ->(date) { where(snapshot_date: date) }
  scope :for_date_range, ->(start_date, end_date) { where(snapshot_date: start_date..end_date) }
  scope :for_status, ->(status) { where(job_status: status) }
  scope :recent, ->(days = 30) { where("snapshot_date >= ?", days.days.ago.to_date) }

  # Trend analysis - get metrics over time for a job
  def self.job_trend(job_id, days: 30)
    for_job(job_id)
      .recent(days)
      .order(:snapshot_date)
  end

  # Compare two dates across all jobs
  def self.compare_dates(date1, date2)
    snapshots1 = for_date(date1).index_by(&:job_id)
    snapshots2 = for_date(date2).index_by(&:job_id)

    common_jobs = snapshots1.keys & snapshots2.keys

    common_jobs.map do |job_id|
      s1 = snapshots1[job_id]
      s2 = snapshots2[job_id]
      {
        job_id: job_id,
        profit_change: s2.profit - s1.profit,
        task_completion_change: s2.completion_rate.to_f - s1.completion_rate.to_f,
        document_count_change: s2.document_count - s1.document_count
      }
    end
  end

  # Aggregated metrics across all jobs for a date
  def self.daily_totals(date)
    for_date(date)
      .select(
        "SUM(total_income) as total_income",
        "SUM(total_expenses) as total_expenses",
        "SUM(profit) as total_profit",
        "AVG(profit_margin) as avg_profit_margin",
        "SUM(task_count) as total_tasks",
        "SUM(completed_task_count) as total_completed",
        "AVG(completion_rate) as avg_completion_rate",
        "COUNT(*) as job_count"
      )
      .first
  end

  # Weekly trend (aggregated by week)
  def self.weekly_trend(weeks: 12)
    where("snapshot_date >= ?", weeks.weeks.ago.to_date)
      .group("DATE_TRUNC('week', snapshot_date)")
      .select(
        "DATE_TRUNC('week', snapshot_date)::date as week_start",
        "AVG(profit) as avg_profit",
        "AVG(completion_rate) as avg_completion_rate",
        "SUM(hours_logged) as total_hours",
        "COUNT(DISTINCT job_id) as job_count"
      )
      .order("week_start")
  end
end
