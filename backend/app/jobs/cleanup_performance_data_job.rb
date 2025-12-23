# frozen_string_literal: true

# Performance Observatory - Data Cleanup Job
# Removes old performance data to maintain storage efficiency
#
# Retention policy:
# - performance_requests: 90 days
# - performance_vitals: 90 days
# - performance_slow_queries: 30 days (more frequent, keep shorter)
#
class CleanupPerformanceDataJob < ApplicationJob
  queue_as :low

  # Don't retry on failure - next scheduled run will handle it
  discard_on StandardError

  def perform
    Rails.logger.info "[CleanupPerformanceDataJob] Starting cleanup..."

    requests_deleted = PerformanceRequest.cleanup_old_records!(days: 90)
    vitals_deleted = PerformanceVital.cleanup_old_records!(days: 90)
    queries_deleted = PerformanceSlowQuery.cleanup_old_records!(days: 30)

    Rails.logger.info "[CleanupPerformanceDataJob] Completed - " \
                      "Requests: #{requests_deleted}, " \
                      "Vitals: #{vitals_deleted}, " \
                      "SlowQueries: #{queries_deleted}"
  end
end
