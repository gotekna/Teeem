# frozen_string_literal: true

module Performance
  # Error Budget Calculator - Computes SLO compliance and error budgets
  #
  # Calculates daily SLO snapshots by measuring actual performance
  # against defined targets. Tracks error budget consumption over time.
  #
  # Usage:
  #   Performance::ErrorBudgetCalculator.calculate_daily_snapshots
  #   Performance::ErrorBudgetCalculator.calculate_for_slo(slo, date)
  #
  class ErrorBudgetCalculator
    class << self
      # Calculate snapshots for all active SLOs for a specific date
      def calculate_daily_snapshots(date: Date.yesterday)
        PerformanceSlo.active.find_each do |slo|
          calculate_for_slo(slo, date)
        rescue => e
          Rails.logger.error "[ErrorBudgetCalculator] Failed for SLO #{slo.id}: #{e.message}"
        end
      end

      # Calculate snapshot for a specific SLO and date
      def calculate_for_slo(slo, date)
        start_time = date.beginning_of_day
        end_time = date.end_of_day

        result = case slo.sli_type
        when "latency"
          calculate_latency_slo(slo, start_time, end_time)
        when "error_rate"
          calculate_error_rate_slo(slo, start_time, end_time)
        when "availability"
          calculate_availability_slo(slo, start_time, end_time)
        when "vital"
          calculate_vital_slo(slo, start_time, end_time)
        when "throughput"
          calculate_throughput_slo(slo, start_time, end_time)
        else
          Rails.logger.warn "[ErrorBudgetCalculator] Unknown SLI type: #{slo.sli_type}"
          return nil
        end

        return nil if result[:total_events].zero?

        # Create or update snapshot
        snapshot = PerformanceSloSnapshot.find_or_initialize_by(
          performance_slo: slo,
          snapshot_date: date
        )

        snapshot.assign_attributes(
          total_events: result[:total_events],
          good_events: result[:good_events],
          bad_events: result[:bad_events],
          observed_value: result[:observed_value],
          metadata: result[:metadata] || {}
        )

        snapshot.save!
        snapshot
      end

      private

      # Calculate latency SLO (P95 response time)
      def calculate_latency_slo(slo, start_time, end_time)
        scope = PerformanceRequest.where(created_at: start_time..end_time)
        scope = scope.where(endpoint: slo.endpoint) if slo.endpoint.present?

        total = scope.count
        return empty_result if total.zero?

        # Calculate P95
        p95 = scope
          .select("PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95")
          .take
          &.p95
          &.to_f || 0

        # Count requests meeting target
        good = scope.where("duration_ms #{comparison_sql(slo.comparison)} ?", slo.target_value).count
        bad = total - good

        {
          total_events: total,
          good_events: good,
          bad_events: bad,
          observed_value: p95.round(1),
          metadata: { percentile: 95 }
        }
      end

      # Calculate error rate SLO
      def calculate_error_rate_slo(slo, start_time, end_time)
        scope = PerformanceRequest.where(created_at: start_time..end_time)
        scope = scope.where(endpoint: slo.endpoint) if slo.endpoint.present?

        total = scope.count
        return empty_result if total.zero?

        errors = scope.where("status_code >= 500").count
        error_rate = (errors.to_f / total * 100).round(2)

        # For error rate, "good" means no error
        good = total - errors
        bad = errors

        {
          total_events: total,
          good_events: good,
          bad_events: bad,
          observed_value: error_rate,
          metadata: { error_count: errors }
        }
      end

      # Calculate availability SLO (based on successful responses)
      def calculate_availability_slo(slo, start_time, end_time)
        scope = PerformanceRequest.where(created_at: start_time..end_time)
        scope = scope.where(endpoint: slo.endpoint) if slo.endpoint.present?

        total = scope.count
        return empty_result if total.zero?

        # Successful = 2xx or 3xx status codes
        successful = scope.where("status_code < 400").count
        availability = (successful.to_f / total * 100).round(2)

        {
          total_events: total,
          good_events: successful,
          bad_events: total - successful,
          observed_value: availability,
          metadata: {}
        }
      end

      # Calculate Web Vital SLO
      def calculate_vital_slo(slo, start_time, end_time)
        scope = PerformanceVital
          .where(created_at: start_time..end_time)
          .where(metric_name: slo.metric_name)

        total = scope.count
        return empty_result if total.zero?

        # Calculate P75 (standard for Web Vitals)
        p75 = scope
          .select("PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75")
          .take
          &.p75
          &.to_f || 0

        # Count samples meeting target
        good = scope.where("value #{comparison_sql(slo.comparison)} ?", slo.target_value).count
        bad = total - good

        {
          total_events: total,
          good_events: good,
          bad_events: bad,
          observed_value: p75.round(2),
          metadata: { percentile: 75, metric: slo.metric_name }
        }
      end

      # Calculate throughput SLO (requests per minute)
      def calculate_throughput_slo(slo, start_time, end_time)
        scope = PerformanceRequest.where(created_at: start_time..end_time)
        scope = scope.where(endpoint: slo.endpoint) if slo.endpoint.present?

        total = scope.count
        minutes = ((end_time - start_time) / 60).to_i
        return empty_result if minutes.zero?

        rpm = (total.to_f / minutes).round(1)

        # For throughput, good = meeting minimum
        meets_target = slo.meets_target?(rpm)

        {
          total_events: minutes, # Use minutes as events for throughput
          good_events: meets_target ? minutes : 0,
          bad_events: meets_target ? 0 : minutes,
          observed_value: rpm,
          metadata: { total_requests: total }
        }
      end

      def comparison_sql(comparison)
        case comparison
        when "lte" then "<="
        when "gte" then ">="
        when "lt" then "<"
        when "gt" then ">"
        when "eq" then "="
        else "<="
        end
      end

      def empty_result
        { total_events: 0, good_events: 0, bad_events: 0, observed_value: nil }
      end
    end
  end
end
