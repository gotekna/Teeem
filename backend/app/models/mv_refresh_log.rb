# Tracks materialized view refresh history
# Used for monitoring, debugging, and data quality tracking
class MvRefreshLog < ApplicationRecord
  # Validations
  validates :view_name, presence: true
  validates :started_at, presence: true
  validates :status, presence: true, inclusion: { in: %w[in_progress success failed] }

  # Scopes
  scope :for_view, ->(name) { where(view_name: name) }
  scope :successful, -> { where(status: "success") }
  scope :failed, -> { where(status: "failed") }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :recent, ->(hours = 24) { where("started_at >= ?", hours.hours.ago) }

  # Start tracking a refresh
  def self.start_refresh(view_name, triggered_by: "scheduled")
    create!(
      view_name: view_name,
      started_at: Time.current,
      status: "in_progress",
      triggered_by: triggered_by,
      previous_row_count: get_row_count(view_name)
    )
  end

  # Mark refresh as completed
  def complete!(row_count: nil)
    update!(
      completed_at: Time.current,
      status: "success",
      duration_seconds: (Time.current - started_at).round(2),
      row_count: row_count || self.class.get_row_count(view_name)
    )
  end

  # Mark refresh as failed
  def fail!(error_message)
    update!(
      completed_at: Time.current,
      status: "failed",
      duration_seconds: (Time.current - started_at).round(2),
      error_message: error_message.to_s.truncate(10_000)
    )
  end

  # Get current row count for a view
  def self.get_row_count(view_name)
    result = ActiveRecord::Base.connection.execute(
      "SELECT COUNT(*) FROM #{ActiveRecord::Base.connection.quote_table_name(view_name)}"
    )
    result.first["count"].to_i
  rescue StandardError
    nil
  end

  # Get latest successful refresh for each view
  def self.latest_per_view
    subquery = select("view_name, MAX(completed_at) as max_completed")
               .where(status: "success")
               .group(:view_name)

    joins("INNER JOIN (#{subquery.to_sql}) latest ON mv_refresh_logs.view_name = latest.view_name AND mv_refresh_logs.completed_at = latest.max_completed")
  end

  # Get summary statistics for a view
  def self.stats_for_view(view_name, days: 7)
    logs = for_view(view_name).where("started_at >= ?", days.days.ago)

    {
      view_name: view_name,
      total_refreshes: logs.count,
      successful: logs.successful.count,
      failed: logs.failed.count,
      success_rate: logs.count > 0 ? (logs.successful.count.to_f / logs.count * 100).round(1) : nil,
      avg_duration_seconds: logs.successful.average(:duration_seconds)&.round(2),
      min_duration_seconds: logs.successful.minimum(:duration_seconds),
      max_duration_seconds: logs.successful.maximum(:duration_seconds),
      last_success: logs.successful.order(completed_at: :desc).first&.completed_at,
      last_failure: logs.failed.order(completed_at: :desc).first&.completed_at,
      latest_row_count: logs.successful.order(completed_at: :desc).first&.row_count
    }
  end

  # Check if any views need attention (failed recently or row count dropped)
  def self.health_check
    RefreshMaterializedViewsJob::VIEWS.map do |key, config|
      view_name = config[:name]
      latest = for_view(view_name).order(started_at: :desc).first
      last_success = for_view(view_name).successful.order(completed_at: :desc).first

      status = if latest&.status == "failed"
                 "error"
      elsif last_success.nil?
                 "unknown"
      elsif last_success.completed_at < 2.hours.ago
                 "stale"
      elsif last_success.previous_row_count && last_success.row_count &&
                     last_success.row_count < last_success.previous_row_count * 0.9
                 "warning"  # Row count dropped by more than 10%
      else
                 "healthy"
      end

      {
        view_name: view_name,
        status: status,
        last_refresh: last_success&.completed_at,
        row_count: last_success&.row_count,
        previous_row_count: last_success&.previous_row_count,
        last_error: latest&.status == "failed" ? latest.error_message : nil
      }
    end
  end
end
