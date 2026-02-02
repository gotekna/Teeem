# frozen_string_literal: true

# Performance Observatory - Request Timing
# Captures backend API request durations for performance analysis
#
# SSoT (Feb 2026): Uses Tenant for isolation, Organization deprecated.
#
class PerformanceRequest < ApplicationRecord
  belongs_to :user, optional: true
  # SSoT (Feb 2026): Tenant is THE ONE for multi-tenancy isolation
  belongs_to :tenant, optional: true
  # DEPRECATED: Organization - kept for backwards compatibility
  belongs_to :organization, optional: true

  validates :endpoint, presence: true
  validates :method, presence: true
  validates :duration_ms, presence: true, numericality: { greater_than_or_equal_to: 0 }

  # HTTP methods
  HTTP_METHODS = %w[GET POST PUT PATCH DELETE HEAD OPTIONS].freeze

  # Performance thresholds (ms)
  THRESHOLD_GOOD = 200
  THRESHOLD_WARNING = 500
  THRESHOLD_SLOW = 1000

  # Scopes for querying
  scope :recent, -> { order(created_at: :desc) }
  scope :since, ->(time) { where("created_at > ?", time) }
  scope :for_endpoint, ->(endpoint) { where(endpoint: endpoint) }
  scope :for_method, ->(method) { where(method: method.upcase) }
  # SSoT: Error scopes - use server_errors for dashboard "error rate"
  # Client errors (401, 404, etc.) are often expected behavior, not failures
  scope :errors, -> { where("status_code >= 400") }  # All errors (for backwards compat)
  scope :server_errors, -> { where("status_code >= 500") }  # Actual failures
  scope :client_errors, -> { where("status_code >= 400 AND status_code < 500") }  # 4xx only
  scope :auth_errors, -> { where(status_code: 401) }  # Unauthorized (often expected)
  scope :successful, -> { where("status_code < 400 OR status_code IS NULL") }
  scope :slow, -> { where("duration_ms > ?", THRESHOLD_SLOW) }
  scope :for_user, ->(user) { where(user: user) }
  # SSoT (Feb 2026): Tenant-scoped lookup
  scope :for_tenant, ->(tenant) { where(tenant: tenant) }
  # DEPRECATED: Use for_tenant instead
  scope :for_organization, ->(org) { where(tenant_id: org.respond_to?(:tenant_id) ? org.tenant_id : org.id) }

  # Calculate percentile for a given set of requests
  def self.percentile(p, column: :duration_ms)
    values = pluck(column).compact.sort
    return nil if values.empty?

    k = (p / 100.0 * (values.length - 1)).round
    values[k]
  end

  # Get P50, P95, P99 stats for a query scope
  def self.latency_stats
    values = pluck(:duration_ms).compact.sort
    return { count: 0, p50: nil, p95: nil, p99: nil, avg: nil } if values.empty?

    {
      count: values.length,
      p50: values[(0.50 * (values.length - 1)).round],
      p95: values[(0.95 * (values.length - 1)).round],
      p99: values[(0.99 * (values.length - 1)).round],
      avg: (values.sum.to_f / values.length).round(1),
      min: values.first,
      max: values.last
    }
  end

  # Aggregate stats by endpoint for dashboard
  def self.endpoint_stats(since: 24.hours.ago)
    since(since)
      .group(:endpoint)
      .select(
        "endpoint",
        "COUNT(*) as request_count",
        "AVG(duration_ms) as avg_duration",
        "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration",
        "COUNT(*) FILTER (WHERE status_code >= 500) as error_count"
      )
      .order("request_count DESC")
  end

  # Error rate for dashboard
  def self.error_rate(since: 24.hours.ago)
    total = since(since).count
    return 0.0 if total.zero?

    errors = since(since).errors.count
    (errors.to_f / total * 100).round(2)
  end

  # Performance rating based on duration
  def rating
    case duration_ms
    when 0...THRESHOLD_GOOD then :good
    when THRESHOLD_GOOD...THRESHOLD_WARNING then :acceptable
    when THRESHOLD_WARNING...THRESHOLD_SLOW then :warning
    else :slow
    end
  end

  # Human-readable summary
  def summary
    "#{method} #{endpoint} - #{duration_ms}ms (#{rating})"
  end

  # Retention: Delete old records (called by scheduled job)
  def self.cleanup_old_records!(days: 90)
    deleted = where("created_at < ?", days.days.ago).delete_all
    Rails.logger.info "[PerformanceRequest] Cleaned up #{deleted} records older than #{days} days"
    deleted
  end
end
