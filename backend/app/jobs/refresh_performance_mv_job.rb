# frozen_string_literal: true

# Performance Observatory - Materialized View Refresh Job
#
# Refreshes all performance materialized views and runs anomaly detection.
# Runs every 5 minutes via SolidQueue to keep dashboard data fresh.
#
# Views Refreshed:
# - mv_endpoint_hourly_metrics (7-day window)
# - mv_endpoint_daily_metrics (90-day window)
# - mv_vital_daily_metrics (90-day window)
#
# After refresh, runs anomaly detection to identify performance issues.
#
class RefreshPerformanceMvJob < ApplicationJob
  queue_as :default

  # Concurrently refresh views to avoid blocking
  REFRESH_CONCURRENTLY = true

  def perform
    start_time = Time.current
    refreshed_views = []
    errors = []

    # Refresh each materialized view
    %w[
      mv_endpoint_hourly_metrics
      mv_endpoint_daily_metrics
      mv_vital_daily_metrics
    ].each do |view_name|
      begin
        refresh_view(view_name)
        refreshed_views << view_name
      rescue => e
        errors << { view: view_name, error: e.message }
        Rails.logger.error "[RefreshPerformanceMVJob] Failed to refresh #{view_name}: #{e.message}"
      end
    end

    # Run anomaly detection after refresh
    begin
      detect_anomalies
    rescue => e
      errors << { step: "anomaly_detection", error: e.message }
      Rails.logger.error "[RefreshPerformanceMVJob] Anomaly detection failed: #{e.message}"
    end

    duration_ms = ((Time.current - start_time) * 1000).round

    if errors.empty?
      Rails.logger.info "[RefreshPerformanceMVJob] Refreshed #{refreshed_views.size} views in #{duration_ms}ms"
    else
      Rails.logger.warn "[RefreshPerformanceMVJob] Completed with #{errors.size} errors in #{duration_ms}ms"
    end
  end

  private

  def refresh_view(view_name)
    # Check if view exists first
    exists = ActiveRecord::Base.connection.execute(<<-SQL).any?
      SELECT 1 FROM pg_matviews WHERE matviewname = '#{view_name}'
    SQL

    return unless exists

    if REFRESH_CONCURRENTLY
      # CONCURRENTLY allows queries during refresh but requires unique index
      ActiveRecord::Base.connection.execute(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY #{view_name}"
      )
    else
      ActiveRecord::Base.connection.execute(
        "REFRESH MATERIALIZED VIEW #{view_name}"
      )
    end
  end

  def detect_anomalies
    # Only run anomaly detection if we have enough data
    return unless PerformanceRequest.where("created_at > ?", 1.hour.ago).exists?

    Performance::AnomalyDetector.detect_all
  end
end
