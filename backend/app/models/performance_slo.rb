# frozen_string_literal: true

# Performance Observatory - Service Level Objective Model
#
# Defines SLO targets for the application. Each SLO has:
# - A Service Level Indicator (SLI) type (latency, availability, error_rate, etc.)
# - A target value and comparison operator
# - An error budget (how much violation is acceptable)
#
# Example SLOs:
# - "API P95 Latency" - P95 response time < 500ms, 99.9% target
# - "Homepage LCP" - Largest Contentful Paint < 2500ms for /
# - "Error Rate" - Error rate < 1% globally
#
class PerformanceSlo < ApplicationRecord
  # Associations
  has_many :snapshots, class_name: "PerformanceSloSnapshot", dependent: :destroy

  # Validations
  validates :name, presence: true
  validates :sli_type, presence: true,
    inclusion: { in: %w[latency availability error_rate throughput vital] }
  validates :target_value, presence: true, numericality: true
  validates :comparison, inclusion: { in: %w[lte gte lt gt eq] }
  validates :error_budget_percent, numericality: { greater_than: 0, less_than_or_equal_to: 100 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_type, ->(type) { where(sli_type: type) }
  scope :for_endpoint, ->(endpoint) { where(endpoint: endpoint) }
  scope :global, -> { where(endpoint: nil) }

  # Default SLOs for new installations
  DEFAULTS = [
    {
      name: "API P95 Latency",
      sli_type: "latency",
      target_value: 500,
      target_unit: "ms",
      comparison: "lte",
      error_budget_percent: 0.1,
      description: "95th percentile API response time should be under 500ms"
    },
    {
      name: "API Error Rate",
      sli_type: "error_rate",
      target_value: 1.0,
      target_unit: "%",
      comparison: "lte",
      error_budget_percent: 0.1,
      description: "Server error rate (5xx) should be under 1%"
    },
    {
      name: "LCP (Largest Contentful Paint)",
      sli_type: "vital",
      metric_name: "LCP",
      target_value: 2500,
      target_unit: "ms",
      comparison: "lte",
      error_budget_percent: 1.0,
      description: "75th percentile LCP should be under 2.5 seconds"
    },
    {
      name: "CLS (Cumulative Layout Shift)",
      sli_type: "vital",
      metric_name: "CLS",
      target_value: 0.1,
      target_unit: "",
      comparison: "lte",
      error_budget_percent: 1.0,
      description: "75th percentile CLS should be under 0.1"
    },
    {
      name: "INP (Interaction to Next Paint)",
      sli_type: "vital",
      metric_name: "INP",
      target_value: 200,
      target_unit: "ms",
      comparison: "lte",
      error_budget_percent: 1.0,
      description: "75th percentile INP should be under 200ms"
    }
  ].freeze

  class << self
    # Seed default SLOs if none exist
    def seed_defaults!
      return if exists?

      DEFAULTS.each do |attrs|
        create!(attrs)
      end
    end

    # Get current compliance status for all active SLOs
    def current_status
      active.includes(:snapshots).map do |slo|
        snapshot = slo.snapshots.order(snapshot_date: :desc).first
        {
          id: slo.id,
          name: slo.name,
          sli_type: slo.sli_type,
          endpoint: slo.endpoint,
          target: "#{slo.comparison_symbol} #{slo.target_value}#{slo.target_unit}",
          status: snapshot&.slo_met ? "met" : "violated",
          compliance_percent: snapshot&.compliance_percent,
          error_budget_remaining: snapshot&.error_budget_remaining,
          observed_value: snapshot&.observed_value,
          last_updated: snapshot&.snapshot_date
        }
      end
    end
  end

  # Instance methods

  def comparison_symbol
    case comparison
    when "lte" then "≤"
    when "gte" then "≥"
    when "lt" then "<"
    when "gt" then ">"
    when "eq" then "="
    else comparison
    end
  end

  # Check if a value meets this SLO
  def meets_target?(value)
    case comparison
    when "lte" then value <= target_value
    when "gte" then value >= target_value
    when "lt" then value < target_value
    when "gt" then value > target_value
    when "eq" then value == target_value
    else false
    end
  end

  # Calculate error budget for a time period
  # Returns: { total_minutes, allowed_bad_minutes, consumed_minutes, remaining_percent }
  def error_budget_for_period(start_time, end_time)
    total_minutes = ((end_time - start_time) / 60).to_i
    allowed_bad_minutes = (total_minutes * error_budget_percent / 100).to_i

    # Get bad events from snapshots
    consumed = snapshots
      .where(snapshot_date: start_time.to_date..end_time.to_date)
      .sum(:bad_events)

    # Estimate minutes based on bad events (rough approximation)
    # For more accuracy, we'd need request-level data
    total_events = snapshots
      .where(snapshot_date: start_time.to_date..end_time.to_date)
      .sum(:total_events)

    consumed_percent = total_events > 0 ? (consumed.to_f / total_events * 100) : 0
    consumed_minutes = (total_minutes * consumed_percent / 100).to_i
    remaining_percent = [100 - (consumed_percent / error_budget_percent * 100), 0].max

    {
      total_minutes: total_minutes,
      allowed_bad_minutes: allowed_bad_minutes,
      consumed_minutes: consumed_minutes,
      remaining_percent: remaining_percent.round(1)
    }
  end

  # Get trend data for the last N days
  def trend(days: 30)
    snapshots
      .where("snapshot_date >= ?", days.days.ago.to_date)
      .order(:snapshot_date)
      .pluck(:snapshot_date, :compliance_percent, :observed_value, :slo_met)
      .map do |date, compliance, observed, met|
        {
          date: date.iso8601,
          compliance_percent: compliance,
          observed_value: observed,
          slo_met: met
        }
      end
  end
end
