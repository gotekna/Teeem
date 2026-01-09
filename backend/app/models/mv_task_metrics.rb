# Read-only model for mv_task_metrics materialized view
# Tracks task completion metrics by job and week
class MvTaskMetrics < ApplicationRecord
  self.table_name = "mv_task_metrics"

  # Read-only - prevent accidental writes
  def readonly?
    true
  end

  # Associations
  belongs_to :job, optional: true

  # Scopes
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :for_week, ->(date) { where(week_start: date.beginning_of_week) }
  scope :for_job_status, ->(status) { where(job_status: status) }
  scope :recent_weeks, ->(n = 4) { where("week_start >= ?", n.weeks.ago.beginning_of_week) }
  scope :with_tasks, -> { where("total_tasks > 0") }

  # Job summary - total metrics across all weeks
  def self.job_summary(job_id)
    for_job(job_id)
      .select(
        "SUM(total_tasks) as total_tasks",
        "SUM(completed_tasks) as completed_tasks",
        "SUM(in_progress_tasks) as in_progress_tasks",
        "SUM(pending_tasks) as pending_tasks",
        "SUM(total_hours_logged) as total_hours",
        "AVG(completion_rate) as avg_completion_rate"
      )
      .first
  end

  # Weekly trend across all jobs
  def self.weekly_trend
    group(:week_start)
      .select(
        "week_start",
        "SUM(total_tasks) as total_tasks",
        "SUM(completed_tasks) as completed_tasks",
        "AVG(completion_rate) as avg_completion_rate",
        "COUNT(DISTINCT job_id) as active_jobs"
      )
      .order(:week_start)
  end

  # Overall statistics
  def self.overall_stats
    select(
      "SUM(total_tasks) as total_tasks",
      "SUM(completed_tasks) as total_completed",
      "SUM(in_progress_tasks) as total_in_progress",
      "SUM(pending_tasks) as total_pending",
      "AVG(completion_rate) as avg_completion_rate"
    ).first
  end

  # Instance helpers
  def on_track?
    completion_rate.to_f >= 80
  end

  def behind_schedule?
    completion_rate.to_f < 50 && pending_tasks.to_i > completed_tasks.to_i
  end

  # Class method to refresh the view
  def self.refresh!(concurrently: false)
    connection.execute("REFRESH MATERIALIZED VIEW mv_task_metrics")
  end

  def self.last_refreshed_at
    first&.refreshed_at
  end
end
