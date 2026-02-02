# Read-only model for mv_job_summary materialized view
# This view pre-computes job metrics for fast dashboard queries
class MvJobSummary < ApplicationRecord
  self.table_name = "mv_job_summary"
  self.primary_key = "job_id"

  # Read-only - prevent accidental writes
  def readonly?
    true
  end

  # Associations for convenience
  belongs_to :job, foreign_key: "job_id"
  belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id", optional: true

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :active_jobs, -> { where(job_status: [ "active", "in_progress" ]) }
  scope :with_activity, -> { where("task_count > 0 OR transaction_count > 0") }

  # Computed fields
  def profit
    total_income - total_expenses
  end

  def profit_margin
    return 0 if total_income.zero?
    (profit / total_income * 100).round(2)
  end

  def task_completion_rate
    return 0 if task_count.zero?
    (completed_tasks.to_f / task_count * 100).round(1)
  end

  def hours_approval_rate
    return 0 if total_hours_logged.zero?
    (approved_hours.to_f / total_hours_logged * 100).round(1)
  end

  # Class method to refresh the view
  def self.refresh!(concurrently: true)
    if concurrently
      connection.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_job_summary")
    else
      connection.execute("REFRESH MATERIALIZED VIEW mv_job_summary")
    end
  end

  # Check when view was last refreshed
  def self.last_refreshed_at
    first&.refreshed_at
  end

  # Check if view is stale (older than threshold)
  def self.stale?(threshold: 1.hour)
    last = last_refreshed_at
    return true if last.nil?
    last < threshold.ago
  end
end
