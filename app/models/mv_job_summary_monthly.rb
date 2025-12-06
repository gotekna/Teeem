# Monthly job summary materialized view
# Pre-aggregated monthly rollups of job metrics
class MvJobSummaryMonthly < ApplicationRecord
  self.table_name = "mv_job_summary_monthly"
  self.primary_key = nil  # No single primary key for this view

  # Scopes
  scope :for_year, ->(year) { where(year: year) }
  scope :for_job_type, ->(job_type) { where(job_type: job_type) }
  scope :for_job_status, ->(status) { where(job_status: status) }
  scope :recent, ->(months = 12) { where("month_start >= ?", months.months.ago.beginning_of_month) }

  # Get job creation trend over time
  def self.creation_trend(months = 12)
    recent(months)
      .group(:month_start)
      .select(
        "month_start",
        "SUM(job_count) as total_jobs",
        "SUM(completed_count) as completed",
        "SUM(in_progress_count) as in_progress"
      )
      .order(:month_start)
  end

  # Get job type distribution for a period
  def self.type_distribution(start_date, end_date)
    where(month_start: start_date..end_date)
      .group(:job_type)
      .select(
        "job_type",
        "SUM(job_count) as total_jobs",
        "SUM(total_income) as revenue",
        "SUM(total_hours) as hours"
      )
      .order("total_jobs DESC")
  end

  # Get completion rate trend
  def self.completion_rate_trend(months = 12)
    recent(months)
      .group(:month_start)
      .having("SUM(job_count) > 0")
      .select(
        "month_start",
        "SUM(completed_count)::float / NULLIF(SUM(job_count), 0) * 100 as completion_rate",
        "SUM(completed_tasks)::float / NULLIF(SUM(total_tasks), 0) * 100 as task_completion_rate"
      )
      .order(:month_start)
  end

  # Get productivity metrics (hours per job)
  def self.productivity_metrics(months = 12)
    recent(months)
      .group(:month_start)
      .having("SUM(job_count) > 0")
      .select(
        "month_start",
        "SUM(total_hours) / NULLIF(SUM(job_count), 0) as avg_hours_per_job",
        "SUM(total_income) / NULLIF(SUM(total_hours), 0) as revenue_per_hour",
        "SUM(total_tasks) / NULLIF(SUM(job_count), 0) as avg_tasks_per_job"
      )
      .order(:month_start)
  end
end
