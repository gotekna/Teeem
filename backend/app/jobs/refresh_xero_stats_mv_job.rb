# frozen_string_literal: true

# Background job to refresh mv_xero_sync_stats materialized view
#
# Purpose: Keep the MV fresh for instant O(1) stat queries.
# Uses CONCURRENTLY to avoid locking the view during refresh.
#
# Schedule: Every 5 minutes
#
# Part of "Scale Xero Sync to 15k" plan (Phase 4)
class RefreshXeroStatsMvJob < ApplicationJob
  queue_as :low

  def perform
    # Check if MV exists (feature flag for rollout)
    unless MvXeroSyncStat.available?
      Rails.logger.info("[RefreshXeroStatsMvJob] MV not available, skipping")
      return
    end

    start_time = Time.current

    # Refresh the materialized view
    elapsed = MvXeroSyncStat.refresh!

    Rails.logger.info("[RefreshXeroStatsMvJob] Completed in #{elapsed}s")
  rescue StandardError => e
    Rails.logger.error("[RefreshXeroStatsMvJob] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    # Don't re-raise - this is a cache refresh, not critical
    # The system falls back to batch queries if MV is stale
  end
end
