# Read-only model for mv_resource_utilization materialized view
# Tracks resource hours logged by week, job, and resource
class MvResourceUtilization < ApplicationRecord
  self.table_name = "mv_resource_utilization"

  # Read-only - prevent accidental writes
  def readonly?
    true
  end

  # Associations
  belongs_to :resource, class_name: "SmResource", foreign_key: "resource_id", optional: true
  belongs_to :job, optional: true

  # Scopes
  scope :for_resource, ->(resource_id) { where(resource_id: resource_id) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :for_week, ->(date) { where(week_start: date.beginning_of_week) }
  scope :for_trade, ->(trade) { where(trade: trade) }
  scope :active_resources, -> { where(is_active: true) }
  scope :recent_weeks, ->(n = 4) { where("week_start >= ?", n.weeks.ago.beginning_of_week) }

  # Summary by resource
  def self.resource_summary(resource_id)
    for_resource(resource_id)
      .group(:week_start)
      .select("week_start, SUM(hours_logged) as total_hours, SUM(approved_hours) as total_approved, SUM(labor_cost) as total_cost")
      .order(:week_start)
  end

  # Summary by job
  def self.job_labor_summary(job_id)
    for_job(job_id)
      .select("SUM(hours_logged) as total_hours, SUM(approved_hours) as approved_hours, SUM(labor_cost) as total_labor_cost, COUNT(DISTINCT resource_id) as resource_count")
      .first
  end

  # Weekly utilization across all resources
  def self.weekly_summary
    group(:week_start)
      .select("week_start, SUM(hours_logged) as total_hours, SUM(labor_cost) as total_cost, COUNT(DISTINCT resource_id) as active_resources")
      .order(:week_start)
  end

  # Class method to refresh the view
  def self.refresh!(concurrently: false)
    connection.execute("REFRESH MATERIALIZED VIEW mv_resource_utilization")
  end

  def self.last_refreshed_at
    first&.refreshed_at
  end
end
