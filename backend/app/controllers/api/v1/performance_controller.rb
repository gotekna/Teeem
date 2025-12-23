# frozen_string_literal: true

module Api
  module V1
    # Performance Observatory - Dashboard API Controller
    # Provides aggregated performance metrics for the admin dashboard
    #
    # GET /api/v1/performance - Main dashboard data
    # GET /api/v1/performance/endpoints - Endpoint-level stats
    # GET /api/v1/performance/vitals - Web Vitals summary
    # GET /api/v1/performance/slow_queries - Slow query analysis
    # GET /api/v1/performance/anomalies - Detected anomalies
    # POST /api/v1/performance/anomalies/:id/acknowledge - Acknowledge anomaly
    # POST /api/v1/performance/anomalies/:id/resolve - Resolve anomaly
    #
    class PerformanceController < ApplicationController
      # GET /api/v1/performance
      # Main dashboard endpoint - returns overview of all performance data
      def index
        since = parse_since_param

        render json: {
          success: true,
          data: {
            overview: build_overview(since),
            web_vitals: build_vitals_summary(since),
            top_endpoints: build_top_endpoints(since),
            slow_queries: build_slow_queries_summary(since),
            trends: build_trends(since),
            anomalies: build_anomalies_summary(since)
          },
          period: {
            since: since.iso8601,
            until: Time.current.iso8601
          }
        }
      end

      # GET /api/v1/performance/endpoints
      # Detailed endpoint performance stats
      def endpoints
        since = parse_since_param
        limit = (params[:limit] || 50).to_i.clamp(1, 200)

        stats = PerformanceRequest
          .since(since)
          .group(:endpoint)
          .select(
            "endpoint",
            "COUNT(*) as request_count",
            "AVG(duration_ms)::integer as avg_duration",
            "PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::integer as p50",
            "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::integer as p95",
            "PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::integer as p99",
            "MIN(duration_ms) as min_duration",
            "MAX(duration_ms) as max_duration",
            "COUNT(*) FILTER (WHERE status_code >= 500) as error_count"
          )
          .order("request_count DESC")
          .limit(limit)

        render json: {
          success: true,
          data: stats.map do |s|
            {
              endpoint: s.endpoint,
              request_count: s.request_count,
              avg_duration: s.avg_duration,
              p50: s.p50,
              p95: s.p95,
              p99: s.p99,
              min_duration: s.min_duration,
              max_duration: s.max_duration,
              error_count: s.error_count,
              error_rate: s.request_count > 0 ? (s.error_count.to_f / s.request_count * 100).round(2) : 0
            }
          end,
          period: { since: since.iso8601 }
        }
      end

      # GET /api/v1/performance/vitals
      # Web Vitals summary with ratings
      def vitals
        since = parse_since_param

        render json: {
          success: true,
          data: PerformanceVital.vitals_summary(since: since),
          period: { since: since.iso8601 }
        }
      end

      # GET /api/v1/performance/slow_queries
      # Slow query analysis
      def slow_queries
        since = parse_since_param
        limit = (params[:limit] || 20).to_i.clamp(1, 100)

        queries = PerformanceSlowQuery.top_slow(limit: limit, since: since)

        render json: {
          success: true,
          data: queries.map do |q|
            {
              fingerprint: truncate_fingerprint(q.query_fingerprint),
              table_name: q.table_name,
              operation: q.operation,
              occurrence_count: q.occurrence_count,
              avg_duration_ms: q.avg_duration_ms,
              max_duration_ms: q.max_duration_ms
            }
          end,
          problematic_tables: PerformanceSlowQuery.problematic_tables(since: since).map do |t|
            {
              table_name: t.table_name,
              slow_query_count: t.slow_query_count,
              avg_duration_ms: t.avg_duration_ms
            }
          end,
          period: { since: since.iso8601 }
        }
      end

      # GET /api/v1/performance/anomalies
      # List detected anomalies
      def anomalies
        since = parse_since_param
        status_filter = params[:status] # open, acknowledged, resolved, all

        anomalies = PerformanceAnomaly.where("detected_at > ?", since)
        anomalies = anomalies.where(status: status_filter) if status_filter.present? && status_filter != "all"
        anomalies = anomalies.order(detected_at: :desc).limit(50)

        render json: {
          success: true,
          data: anomalies.map { |a| anomaly_to_json(a) },
          summary: PerformanceAnomaly.summary(since: since),
          period: { since: since.iso8601 }
        }
      end

      # POST /api/v1/performance/anomalies/:id/acknowledge
      def acknowledge_anomaly
        anomaly = PerformanceAnomaly.find(params[:id])
        anomaly.acknowledge!(current_user)

        render json: {
          success: true,
          data: anomaly_to_json(anomaly)
        }
      end

      # POST /api/v1/performance/anomalies/:id/resolve
      def resolve_anomaly
        anomaly = PerformanceAnomaly.find(params[:id])
        anomaly.resolve!

        render json: {
          success: true,
          data: anomaly_to_json(anomaly)
        }
      end

      # POST /api/v1/performance/anomalies/:id/false_positive
      def mark_false_positive
        anomaly = PerformanceAnomaly.find(params[:id])
        anomaly.mark_false_positive!

        render json: {
          success: true,
          data: anomaly_to_json(anomaly)
        }
      end

      private

      def parse_since_param
        case params[:period]
        when "1h" then 1.hour.ago
        when "6h" then 6.hours.ago
        when "24h", "1d" then 24.hours.ago
        when "7d" then 7.days.ago
        when "30d" then 30.days.ago
        else
          24.hours.ago # Default to last 24 hours
        end
      end

      def build_overview(since)
        requests = PerformanceRequest.since(since)
        total = requests.count

        return empty_overview if total.zero?

        stats = requests.latency_stats
        error_count = requests.errors.count

        {
          total_requests: total,
          avg_response_time: stats[:avg],
          p50_response_time: stats[:p50],
          p95_response_time: stats[:p95],
          p99_response_time: stats[:p99],
          error_rate: (error_count.to_f / total * 100).round(2),
          error_count: error_count,
          requests_per_minute: (total.to_f / ((Time.current - since) / 60)).round(1)
        }
      end

      def empty_overview
        {
          total_requests: 0,
          avg_response_time: nil,
          p50_response_time: nil,
          p95_response_time: nil,
          p99_response_time: nil,
          error_rate: 0,
          error_count: 0,
          requests_per_minute: 0
        }
      end

      def build_vitals_summary(since)
        PerformanceVital.vitals_summary(since: since)
      end

      def build_top_endpoints(since, limit: 10)
        PerformanceRequest
          .since(since)
          .group(:endpoint)
          .select(
            "endpoint",
            "COUNT(*) as request_count",
            "AVG(duration_ms)::integer as avg_duration",
            "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::integer as p95"
          )
          .order("p95 DESC")
          .limit(limit)
          .map do |e|
            {
              endpoint: e.endpoint,
              request_count: e.request_count,
              avg_duration: e.avg_duration,
              p95: e.p95
            }
          end
      end

      def build_slow_queries_summary(since, limit: 5)
        PerformanceSlowQuery
          .since(since)
          .group(:table_name)
          .select(
            "table_name",
            "COUNT(*) as query_count",
            "AVG(duration_ms)::integer as avg_duration"
          )
          .order("query_count DESC")
          .limit(limit)
          .map do |q|
            {
              table_name: q.table_name,
              query_count: q.query_count,
              avg_duration: q.avg_duration
            }
          end
      end

      def build_trends(since)
        # Hourly request counts for trend visualization
        PerformanceRequest
          .since(since)
          .group(Arel.sql("date_trunc('hour', created_at)"))
          .select(
            "date_trunc('hour', created_at) as hour",
            "COUNT(*) as request_count",
            "AVG(duration_ms)::integer as avg_duration",
            "COUNT(*) FILTER (WHERE status_code >= 500) as error_count"
          )
          .order(Arel.sql("date_trunc('hour', created_at)"))
          .map do |t|
            {
              hour: t.hour.iso8601,
              request_count: t.request_count,
              avg_duration: t.avg_duration,
              error_count: t.error_count
            }
          end
      end

      def truncate_fingerprint(fingerprint, max_length: 100)
        return fingerprint if fingerprint.length <= max_length

        "#{fingerprint[0...max_length]}..."
      end

      def build_anomalies_summary(since)
        anomalies = PerformanceAnomaly.where("detected_at > ?", since)

        {
          total: anomalies.count,
          open: anomalies.open.count,
          critical: anomalies.critical.count,
          recent: anomalies.open.order(detected_at: :desc).limit(5).map { |a| anomaly_to_json(a) }
        }
      end

      def anomaly_to_json(anomaly)
        {
          id: anomaly.id,
          anomaly_type: anomaly.anomaly_type,
          severity: anomaly.severity,
          status: anomaly.status,
          endpoint: anomaly.endpoint,
          metric_name: anomaly.metric_name,
          table_name: anomaly.table_name,
          observed_value: anomaly.observed_value,
          expected_value: anomaly.expected_value,
          z_score: anomaly.z_score&.round(2),
          description: anomaly.to_description,
          detected_at: anomaly.detected_at.iso8601,
          resolved_at: anomaly.resolved_at&.iso8601,
          context: anomaly.context
        }
      end
    end
  end
end
