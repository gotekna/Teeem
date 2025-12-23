# frozen_string_literal: true

module Performance
  # Anomaly Detector - Statistical detection of performance issues
  #
  # Uses z-score analysis to detect anomalies by comparing current
  # performance against historical baselines.
  #
  # Detection Types:
  # 1. Latency Spikes - P95 response time significantly above baseline
  # 2. Error Spikes - Error rate significantly above baseline
  # 3. Slow Query Surges - Sudden increase in slow queries
  # 4. Vital Degradation - Web Vitals significantly worse
  #
  # Z-Score Thresholds:
  # - z >= 2: Info (notable but not actionable)
  # - z >= 3: Warning (should investigate)
  # - z >= 4: Critical (immediate attention)
  #
  class AnomalyDetector
    # Minimum data points needed for reliable detection
    MIN_BASELINE_POINTS = 6 # 6 hours of data minimum

    # Z-score threshold for anomaly detection
    Z_SCORE_THRESHOLD = 2.0

    class << self
      def detect_all
        anomalies = []
        anomalies.concat(detect_latency_spikes)
        anomalies.concat(detect_error_spikes)
        anomalies.concat(detect_slow_query_surges)
        anomalies.concat(detect_vital_degradation)
        anomalies
      end

      # Detect endpoints with abnormally high P95 latency
      def detect_latency_spikes
        anomalies = []

        # Get current hour's metrics vs baseline
        current_hour = Time.current.beginning_of_hour
        baseline_start = 7.days.ago

        # Query hourly metrics from materialized view
        current_metrics = query_mv_hourly(current_hour)
        return anomalies if current_metrics.empty?

        current_metrics.each do |endpoint, current|
          # Get baseline stats for this endpoint (excluding current hour)
          baseline = baseline_stats_for_endpoint(endpoint, baseline_start, current_hour)
          next unless baseline[:count] >= MIN_BASELINE_POINTS

          # Calculate z-score for P95 latency
          z_score = calculate_z_score(current[:p95], baseline[:mean], baseline[:stddev])
          next unless z_score && z_score >= Z_SCORE_THRESHOLD

          severity = PerformanceAnomaly.severity_for_z_score(z_score)
          next unless severity

          anomaly = PerformanceAnomaly.find_or_create_anomaly(
            anomaly_type: "latency_spike",
            severity: severity,
            endpoint: endpoint,
            observed_value: current[:p95],
            expected_value: baseline[:mean],
            threshold: baseline[:mean] + (Z_SCORE_THRESHOLD * baseline[:stddev]),
            z_score: z_score,
            detected_at: Time.current,
            context: {
              request_count: current[:request_count],
              baseline_hours: baseline[:count],
              current_avg: current[:avg_duration]
            }
          )

          anomalies << anomaly if anomaly.persisted?
        end

        anomalies
      end

      # Detect endpoints with abnormally high error rates
      def detect_error_spikes
        anomalies = []

        current_hour = Time.current.beginning_of_hour

        # Get endpoints with errors in the current hour
        current_errors = PerformanceRequest
          .where("created_at >= ?", current_hour)
          .where("status_code >= 500")
          .group(:endpoint)
          .select("endpoint, COUNT(*) as error_count")
          .to_a

        return anomalies if current_errors.empty?

        current_errors.each do |record|
          endpoint = record.endpoint
          error_count = record.error_count

          # Get total requests for this hour to calculate rate
          total_requests = PerformanceRequest
            .where("created_at >= ?", current_hour)
            .where(endpoint: endpoint)
            .count

          next if total_requests < 10 # Need enough requests

          current_error_rate = error_count.to_f / total_requests

          # Get baseline error rate
          baseline_error_rate = PerformanceRequest
            .where("created_at > ? AND created_at < ?", 7.days.ago, current_hour)
            .where(endpoint: endpoint)
            .where("status_code >= 500")
            .count.to_f / [PerformanceRequest
              .where("created_at > ? AND created_at < ?", 7.days.ago, current_hour)
              .where(endpoint: endpoint)
              .count, 1].max

          # Simple threshold: 5x baseline or > 5% error rate
          next unless current_error_rate > 0.05 || current_error_rate > (baseline_error_rate * 5)

          severity = if current_error_rate > 0.2
            "critical"
          elsif current_error_rate > 0.1
            "warning"
          else
            "info"
          end

          anomaly = PerformanceAnomaly.find_or_create_anomaly(
            anomaly_type: "error_spike",
            severity: severity,
            endpoint: endpoint,
            observed_value: current_error_rate,
            expected_value: baseline_error_rate,
            detected_at: Time.current,
            context: {
              error_count: error_count,
              total_requests: total_requests
            }
          )

          anomalies << anomaly if anomaly.persisted?
        end

        anomalies
      end

      # Detect tables with sudden increase in slow queries
      def detect_slow_query_surges
        anomalies = []

        current_hour = Time.current.beginning_of_hour

        # Count slow queries per table in current hour
        current_counts = PerformanceSlowQuery
          .where("created_at >= ?", current_hour)
          .group(:table_name)
          .count

        return anomalies if current_counts.empty?

        current_counts.each do |table_name, current_count|
          next if current_count < 5 # Minimum threshold

          # Get baseline hourly average
          baseline_avg = PerformanceSlowQuery
            .where("created_at > ? AND created_at < ?", 7.days.ago, current_hour)
            .where(table_name: table_name)
            .count.to_f / (7 * 24) # Average per hour over 7 days

          next if baseline_avg < 1 # Not enough baseline data

          # Detect if current is significantly above baseline
          ratio = current_count / baseline_avg
          next unless ratio >= 3 # At least 3x baseline

          severity = if ratio >= 10
            "critical"
          elsif ratio >= 5
            "warning"
          else
            "info"
          end

          anomaly = PerformanceAnomaly.find_or_create_anomaly(
            anomaly_type: "slow_query_surge",
            severity: severity,
            table_name: table_name,
            observed_value: current_count,
            expected_value: baseline_avg,
            detected_at: Time.current,
            context: {
              ratio: ratio.round(1),
              baseline_daily_avg: (baseline_avg * 24).round
            }
          )

          anomalies << anomaly if anomaly.persisted?
        end

        anomalies
      end

      # Detect Web Vitals that have degraded significantly
      def detect_vital_degradation
        anomalies = []

        today = Date.current
        baseline_start = 7.days.ago.to_date

        # Get today's vitals
        today_vitals = PerformanceVital
          .where("created_at >= ?", today.beginning_of_day)
          .group(:metric_name)
          .select(
            "metric_name",
            "COUNT(*) as sample_count",
            "PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75"
          )
          .to_a

        return anomalies if today_vitals.empty?

        today_vitals.each do |vital|
          next if vital.sample_count < 10 # Need enough samples

          # Get baseline P75 for this metric
          baseline = PerformanceVital
            .where("created_at >= ? AND created_at < ?", baseline_start, today)
            .where(metric_name: vital.metric_name)
            .select(
              "AVG(value) as mean",
              "STDDEV(value) as stddev",
              "COUNT(*) as count"
            )
            .first

          next unless baseline && baseline.count >= 50

          z_score = calculate_z_score(vital.p75, baseline.mean, baseline.stddev)
          next unless z_score && z_score >= Z_SCORE_THRESHOLD

          severity = PerformanceAnomaly.severity_for_z_score(z_score)
          next unless severity

          anomaly = PerformanceAnomaly.find_or_create_anomaly(
            anomaly_type: "vital_degradation",
            severity: severity,
            metric_name: vital.metric_name,
            observed_value: vital.p75,
            expected_value: baseline.mean,
            z_score: z_score,
            detected_at: Time.current,
            context: {
              sample_count: vital.sample_count,
              baseline_samples: baseline.count
            }
          )

          anomalies << anomaly if anomaly.persisted?
        end

        anomalies
      end

      private

      def query_mv_hourly(hour)
        result = {}

        # Try to query the materialized view
        begin
          rows = ActiveRecord::Base.connection.execute(<<-SQL)
            SELECT endpoint, request_count, avg_duration, p95, error_count
            FROM mv_endpoint_hourly_metrics
            WHERE hour = '#{hour.iso8601}'
          SQL

          rows.each do |row|
            result[row["endpoint"]] = {
              request_count: row["request_count"],
              avg_duration: row["avg_duration"],
              p95: row["p95"],
              error_count: row["error_count"]
            }
          end
        rescue => e
          # Materialized view might not exist yet - fall back to direct query
          Rails.logger.debug "[AnomalyDetector] MV query failed, using direct query: #{e.message}"

          PerformanceRequest
            .where("created_at >= ? AND created_at < ?", hour, hour + 1.hour)
            .group(:endpoint)
            .select(
              "endpoint",
              "COUNT(*) as request_count",
              "AVG(duration_ms)::integer as avg_duration",
              "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::integer as p95",
              "COUNT(*) FILTER (WHERE status_code >= 500) as error_count"
            )
            .each do |row|
              result[row.endpoint] = {
                request_count: row.request_count,
                avg_duration: row.avg_duration,
                p95: row.p95,
                error_count: row.error_count
              }
            end
        end

        result
      end

      def baseline_stats_for_endpoint(endpoint, start_time, end_time)
        result = PerformanceRequest
          .where("created_at > ? AND created_at < ?", start_time, end_time)
          .where(endpoint: endpoint)
          .group(Arel.sql("date_trunc('hour', created_at)"))
          .select(
            "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95"
          )
          .to_a

        return { count: 0, mean: 0, stddev: 0 } if result.empty?

        p95_values = result.map { |r| r.p95.to_f }
        count = p95_values.size
        mean = p95_values.sum / count
        variance = p95_values.map { |v| (v - mean) ** 2 }.sum / count
        stddev = Math.sqrt(variance)

        { count: count, mean: mean, stddev: stddev }
      end

      def calculate_z_score(observed, mean, stddev)
        return nil if stddev.nil? || stddev.zero?

        (observed - mean) / stddev
      end
    end
  end
end
