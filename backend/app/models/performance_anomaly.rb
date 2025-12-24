# frozen_string_literal: true

# Performance Observatory - Anomaly Model
#
# Stores detected performance anomalies for tracking and analysis.
# Anomalies are detected by the AnomalyDetector service based on
# statistical analysis (z-score) of historical performance data.
#
# Anomaly Types:
# - latency_spike: P95 response time significantly above baseline
# - error_spike: Error rate significantly above baseline
# - slow_query_surge: Sudden increase in slow queries for a table
# - vital_degradation: Web Vital metric degraded significantly
#
# Severity Levels:
# - info: Notable but not actionable (z-score 2-3)
# - warning: Should investigate (z-score 3-4)
# - critical: Immediate attention needed (z-score > 4)
#
class PerformanceAnomaly < ApplicationRecord
  # Associations
  belongs_to :acknowledged_by, class_name: "User", optional: true

  # Validations
  validates :anomaly_type, presence: true,
    inclusion: { in: %w[latency_spike error_spike slow_query_surge vital_degradation] }
  validates :severity, presence: true,
    inclusion: { in: %w[info warning critical] }
  validates :observed_value, presence: true
  validates :detected_at, presence: true
  validates :status, inclusion: { in: %w[open acknowledged resolved false_positive] }

  # Scopes
  scope :open, -> { where(status: "open") }
  scope :unresolved, -> { where(status: %w[open acknowledged]) }
  scope :resolved, -> { where(status: "resolved") }
  scope :critical, -> { where(severity: "critical") }
  scope :warning_or_above, -> { where(severity: %w[warning critical]) }
  scope :recent, -> { where("detected_at > ?", 24.hours.ago) }
  scope :for_endpoint, ->(endpoint) { where(endpoint: endpoint) }
  scope :by_type, ->(type) { where(anomaly_type: type) }

  # Class Methods

  # Calculate severity based on z-score
  def self.severity_for_z_score(z_score)
    case z_score.abs
    when 0...2 then nil # Not anomalous
    when 2...3 then "info"
    when 3...4 then "warning"
    else "critical"
    end
  end

  # Find or create anomaly for deduplication
  # Only creates new anomaly if no similar open anomaly exists
  def self.find_or_create_anomaly(attrs)
    # Look for existing open anomaly of same type/endpoint within last hour
    existing = unresolved
      .where(anomaly_type: attrs[:anomaly_type])
      .where(endpoint: attrs[:endpoint])
      .where("detected_at > ?", 1.hour.ago)
      .first

    return existing if existing

    create(attrs)
  end

  # Summary for dashboard
  def self.summary(since: 24.hours.ago)
    {
      total: where("detected_at > ?", since).count,
      open: where("detected_at > ?", since).open.count,
      critical: where("detected_at > ?", since).critical.count,
      by_type: where("detected_at > ?", since)
        .group(:anomaly_type)
        .count,
      by_severity: where("detected_at > ?", since)
        .group(:severity)
        .count
    }
  end

  # Instance Methods

  def acknowledge!(user)
    update!(
      status: "acknowledged",
      acknowledged_by: user
    )
  end

  def resolve!
    update!(
      status: "resolved",
      resolved_at: Time.current
    )
  end

  def mark_false_positive!
    update!(status: "false_positive")
  end

  def open?
    status == "open"
  end

  def critical?
    severity == "critical"
  end

  # Human-readable description
  def to_description
    case anomaly_type
    when "latency_spike"
      "#{endpoint} P95 latency spiked to #{observed_value.round}ms " \
      "(expected: #{expected_value&.round || '?'}ms, #{z_score&.round(1) || '?'}σ)"
    when "error_spike"
      "#{endpoint} error rate spiked to #{(observed_value * 100).round(2)}% " \
      "(expected: #{((expected_value || 0) * 100).round(2)}%)"
    when "slow_query_surge"
      "#{table_name} had #{observed_value.round} slow queries " \
      "(expected: #{expected_value&.round || '?'})"
    when "vital_degradation"
      "#{metric_name} degraded to #{observed_value.round}ms P75 " \
      "(expected: #{expected_value&.round || '?'}ms)"
    else
      description || "Unknown anomaly"
    end
  end
end
