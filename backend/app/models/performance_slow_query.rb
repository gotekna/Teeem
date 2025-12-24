# frozen_string_literal: true

# Performance Observatory - Slow Query Tracking
# Captures SQL queries exceeding threshold for analysis
class PerformanceSlowQuery < ApplicationRecord
  belongs_to :user, optional: true

  # Threshold for capturing (queries slower than this are logged)
  SLOW_THRESHOLD_MS = 100

  # SQL operations
  OPERATIONS = %w[SELECT INSERT UPDATE DELETE].freeze

  validates :query_fingerprint, presence: true
  validates :duration_ms, presence: true, numericality: { greater_than: 0 }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :since, ->(time) { where("created_at > ?", time) }
  scope :for_table, ->(table) { where(table_name: table) }
  scope :for_operation, ->(op) { where(operation: op.upcase) }
  scope :for_endpoint, ->(endpoint) { where(endpoint: endpoint) }
  scope :very_slow, -> { where("duration_ms > ?", 500) }
  scope :extremely_slow, -> { where("duration_ms > ?", 1000) }

  # Aggregate slow queries by fingerprint for dashboard
  def self.query_stats(since: 24.hours.ago)
    since(since)
      .group(:query_fingerprint, :table_name, :operation)
      .select(
        "query_fingerprint",
        "table_name",
        "operation",
        "COUNT(*) as occurrence_count",
        "AVG(duration_ms) as avg_duration",
        "MAX(duration_ms) as max_duration",
        "MIN(duration_ms) as min_duration"
      )
      .order("occurrence_count DESC")
  end

  # Top slow queries for investigation
  def self.top_slow(limit: 10, since: 24.hours.ago)
    since(since)
      .select(
        "query_fingerprint",
        "table_name",
        "operation",
        "COUNT(*) as occurrence_count",
        "AVG(duration_ms)::integer as avg_duration_ms",
        "MAX(duration_ms) as max_duration_ms"
      )
      .group(:query_fingerprint, :table_name, :operation)
      .order("avg_duration_ms DESC")
      .limit(limit)
  end

  # Tables with most slow queries
  def self.problematic_tables(since: 24.hours.ago)
    since(since)
      .group(:table_name)
      .select(
        "table_name",
        "COUNT(*) as slow_query_count",
        "AVG(duration_ms)::integer as avg_duration_ms",
        "MAX(duration_ms) as max_duration_ms"
      )
      .order("slow_query_count DESC")
  end

  # Endpoints triggering most slow queries
  def self.problematic_endpoints(since: 24.hours.ago)
    since(since)
      .where.not(endpoint: nil)
      .group(:endpoint)
      .select(
        "endpoint",
        "COUNT(*) as slow_query_count",
        "AVG(duration_ms)::integer as avg_duration_ms"
      )
      .order("slow_query_count DESC")
  end

  # Normalize a SQL query to a fingerprint (remove specific values)
  def self.fingerprint(sql)
    # Replace string values
    normalized = sql.gsub(/'[^']*'/, "'?'")
    # Replace numeric values
    normalized = normalized.gsub(/\b\d+\b/, "?")
    # Replace IN lists
    normalized = normalized.gsub(/\(\?(?:, ?\?)+\)/, "(?)")
    # Remove extra whitespace
    normalized.squish
  end

  # Extract table name from SQL
  def self.extract_table(sql)
    # Match FROM/INTO/UPDATE table patterns
    match = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+["`]?(\w+)["`]?/i)
    match&.captures&.first
  end

  # Extract operation from SQL
  def self.extract_operation(sql)
    sql.strip.split(/\s+/).first&.upcase
  end

  # Retention: Delete old records
  def self.cleanup_old_records!(days: 30)
    deleted = where("created_at < ?", days.days.ago).delete_all
    Rails.logger.info "[PerformanceSlowQuery] Cleaned up #{deleted} records older than #{days} days"
    deleted
  end
end
