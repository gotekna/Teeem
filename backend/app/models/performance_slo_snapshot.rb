# frozen_string_literal: true

# Performance Observatory - SLO Snapshot Model
#
# Daily snapshots of SLO compliance. Created by the SLO calculation job
# each day to track error budget consumption over time.
#
# Each snapshot contains:
# - Total events (requests, samples) for the day
# - Good/bad event counts
# - Compliance percentage
# - Error budget remaining
# - Observed value (e.g., actual P95 latency)
#
class PerformanceSloSnapshot < ApplicationRecord
  # Associations
  belongs_to :performance_slo

  # Validations
  validates :snapshot_date, presence: true
  validates :snapshot_date, uniqueness: { scope: :performance_slo_id }

  # Scopes
  scope :recent, -> { where("snapshot_date >= ?", 30.days.ago) }
  scope :for_date, ->(date) { where(snapshot_date: date) }
  scope :met, -> { where(slo_met: true) }
  scope :violated, -> { where(slo_met: false) }

  # Callbacks
  before_save :calculate_derived_fields

  private

  def calculate_derived_fields
    return if total_events.zero?

    # Calculate compliance percentage
    self.compliance_percent = (good_events.to_f / total_events * 100).round(2)

    # Calculate error budget consumption
    target_compliance = 100 - performance_slo.error_budget_percent
    actual_bad_percent = (bad_events.to_f / total_events * 100)

    # Error budget consumed is how much of our allowed bad % we've used
    if performance_slo.error_budget_percent > 0
      self.error_budget_consumed = (actual_bad_percent / performance_slo.error_budget_percent * 100).round(2)
      self.error_budget_remaining = [100 - error_budget_consumed, 0].max.round(2)
    else
      self.error_budget_consumed = actual_bad_percent > 0 ? 100 : 0
      self.error_budget_remaining = actual_bad_percent > 0 ? 0 : 100
    end

    # Determine if SLO was met
    self.slo_met = compliance_percent >= target_compliance
  end
end
