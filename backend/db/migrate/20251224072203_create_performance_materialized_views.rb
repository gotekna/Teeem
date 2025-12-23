# frozen_string_literal: true

# Performance Observatory - Q2: Intelligent Aggregation
#
# Creates materialized views for efficient dashboard queries and
# anomaly detection table for storing detected performance issues.
#
# Materialized Views:
# - mv_endpoint_hourly_metrics: Hourly rollups per endpoint (P50, P95, P99)
# - mv_endpoint_daily_metrics: Daily rollups per endpoint
# - mv_vital_daily_metrics: Daily Web Vitals aggregation
#
# Tables:
# - performance_anomalies: Stores detected performance anomalies
#
class CreatePerformanceMaterializedViews < ActiveRecord::Migration[8.0]
  def up
    # Hourly endpoint metrics (last 7 days for real-time monitoring)
    execute <<-SQL
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_endpoint_hourly_metrics AS
      SELECT
        endpoint,
        date_trunc('hour', created_at) AS hour,
        COUNT(*) AS request_count,
        AVG(duration_ms)::integer AS avg_duration,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::integer AS p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::integer AS p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::integer AS p99,
        MIN(duration_ms) AS min_duration,
        MAX(duration_ms) AS max_duration,
        AVG(db_time_ms)::integer AS avg_db_time,
        COUNT(*) FILTER (WHERE status_code >= 500) AS error_count,
        COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS client_error_count
      FROM performance_requests
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY endpoint, date_trunc('hour', created_at)
      ORDER BY hour DESC, request_count DESC;
    SQL

    # Index for fast lookups
    execute <<-SQL
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_endpoint_hourly_endpoint_hour
      ON mv_endpoint_hourly_metrics (endpoint, hour);
    SQL

    execute <<-SQL
      CREATE INDEX IF NOT EXISTS idx_mv_endpoint_hourly_hour
      ON mv_endpoint_hourly_metrics (hour);
    SQL

    # Daily endpoint metrics (last 90 days for trend analysis)
    execute <<-SQL
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_endpoint_daily_metrics AS
      SELECT
        endpoint,
        date_trunc('day', created_at) AS day,
        COUNT(*) AS request_count,
        AVG(duration_ms)::integer AS avg_duration,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::integer AS p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::integer AS p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::integer AS p99,
        MIN(duration_ms) AS min_duration,
        MAX(duration_ms) AS max_duration,
        AVG(db_time_ms)::integer AS avg_db_time,
        COUNT(*) FILTER (WHERE status_code >= 500) AS error_count
      FROM performance_requests
      WHERE created_at > NOW() - INTERVAL '90 days'
      GROUP BY endpoint, date_trunc('day', created_at)
      ORDER BY day DESC, request_count DESC;
    SQL

    execute <<-SQL
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_endpoint_daily_endpoint_day
      ON mv_endpoint_daily_metrics (endpoint, day);
    SQL

    execute <<-SQL
      CREATE INDEX IF NOT EXISTS idx_mv_endpoint_daily_day
      ON mv_endpoint_daily_metrics (day);
    SQL

    # Daily Web Vitals metrics
    execute <<-SQL
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vital_daily_metrics AS
      SELECT
        metric_name,
        date_trunc('day', created_at) AS day,
        COUNT(*) AS sample_count,
        AVG(value) AS avg_value,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) AS p75_value,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) AS p95_value,
        COUNT(*) FILTER (WHERE rating = 'good') AS good_count,
        COUNT(*) FILTER (WHERE rating = 'needs-improvement') AS needs_improvement_count,
        COUNT(*) FILTER (WHERE rating = 'poor') AS poor_count
      FROM performance_vitals
      WHERE created_at > NOW() - INTERVAL '90 days'
      GROUP BY metric_name, date_trunc('day', created_at)
      ORDER BY day DESC, metric_name;
    SQL

    execute <<-SQL
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vital_daily_metric_day
      ON mv_vital_daily_metrics (metric_name, day);
    SQL

    # Anomalies table for storing detected issues
    create_table :performance_anomalies do |t|
      t.string :anomaly_type, null: false # latency_spike, error_spike, slow_query_surge, vital_degradation
      t.string :severity, null: false # info, warning, critical
      t.string :endpoint
      t.string :metric_name # For vitals
      t.string :table_name # For slow queries
      t.float :observed_value, null: false
      t.float :expected_value
      t.float :threshold
      t.float :z_score # Standard deviations from mean
      t.string :status, default: "open" # open, acknowledged, resolved, false_positive
      t.text :description
      t.jsonb :context, default: {} # Additional context data
      t.datetime :detected_at, null: false
      t.datetime :resolved_at
      t.references :acknowledged_by, foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :performance_anomalies, :anomaly_type
    add_index :performance_anomalies, :severity
    add_index :performance_anomalies, :status
    add_index :performance_anomalies, :detected_at
    add_index :performance_anomalies, [:endpoint, :detected_at]
  end

  def down
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_vital_daily_metrics CASCADE;"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_endpoint_daily_metrics CASCADE;"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_endpoint_hourly_metrics CASCADE;"
    drop_table :performance_anomalies
  end
end
