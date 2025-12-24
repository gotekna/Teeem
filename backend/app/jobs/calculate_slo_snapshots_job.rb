# frozen_string_literal: true

# Performance Observatory - Daily SLO Snapshot Calculator
#
# Runs daily to calculate SLO compliance snapshots for all active SLOs.
# Also seeds default SLOs if none exist.
#
# Schedule: Daily at 1:00 AM Brisbane time (after midnight data is complete)
#
class CalculateSloSnapshotsJob < ApplicationJob
  queue_as :low

  def perform(date: Date.yesterday)
    # Seed defaults if no SLOs exist
    PerformanceSlo.seed_defaults! unless PerformanceSlo.exists?

    # Calculate snapshots for yesterday's data
    Performance::ErrorBudgetCalculator.calculate_daily_snapshots(date: date)

    Rails.logger.info "[CalculateSloSnapshotsJob] Calculated snapshots for #{date}"
  end
end
