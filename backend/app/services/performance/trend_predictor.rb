# frozen_string_literal: true

module Performance
  # Trend Predictor - Linear regression for performance forecasting
  #
  # Uses simple linear regression to predict future performance based on
  # historical data. Helps identify degradation trends before they become
  # critical issues.
  #
  # Usage:
  #   predictor = Performance::TrendPredictor.new(historical_data)
  #   prediction = predictor.predict(days_ahead: 7)
  #
  # Features:
  # - Predicts when error budget will be exhausted
  # - Forecasts latency trends
  # - Detects degradation patterns
  #
  class TrendPredictor
    attr_reader :data_points, :slope, :intercept, :r_squared

    # Initialize with array of { x: day_number, y: value } or [value1, value2, ...]
    def initialize(data)
      @data_points = normalize_data(data)
      calculate_regression if @data_points.size >= 2
    end

    # Predict value at future point
    def predict(days_ahead: 7)
      return nil unless valid?

      last_x = @data_points.last[:x]
      future_x = last_x + days_ahead

      predicted_value = @intercept + (@slope * future_x)

      {
        predicted_value: predicted_value.round(2),
        days_ahead: days_ahead,
        confidence: confidence_level,
        trend: trend_direction,
        slope_per_day: @slope.round(4)
      }
    end

    # Predict when a threshold will be crossed
    def predict_threshold_crossing(threshold, direction: :above)
      return nil unless valid?
      return nil if @slope.zero?

      # Solve for x: threshold = intercept + slope * x
      crossing_x = (threshold - @intercept) / @slope
      last_x = @data_points.last[:x]

      days_until = crossing_x - last_x

      return nil if days_until <= 0 # Already crossed or will never cross

      # Verify direction matches
      if direction == :above && @slope < 0
        return nil # Decreasing trend won't cross above
      elsif direction == :below && @slope > 0
        return nil # Increasing trend won't cross below
      end

      {
        days_until_crossing: days_until.round(1),
        threshold: threshold,
        predicted_date: Date.current + days_until.round.days,
        confidence: confidence_level
      }
    end

    # Predict error budget exhaustion
    def predict_budget_exhaustion(current_remaining_percent, burn_rate_per_day)
      return nil if burn_rate_per_day <= 0

      days_until = current_remaining_percent / burn_rate_per_day

      {
        days_until_exhaustion: days_until.round(1),
        predicted_date: Date.current + days_until.round.days,
        burn_rate_per_day: burn_rate_per_day.round(2)
      }
    end

    def valid?
      @slope.present? && @intercept.present?
    end

    def trend_direction
      return :stable unless valid?

      if @slope.abs < 0.01
        :stable
      elsif @slope > 0
        :increasing
      else
        :decreasing
      end
    end

    def confidence_level
      return :low unless valid?

      if @r_squared.nil?
        :unknown
      elsif @r_squared >= 0.8
        :high
      elsif @r_squared >= 0.5
        :medium
      else
        :low
      end
    end

    private

    def normalize_data(data)
      return [] if data.blank?

      # If array of hashes with x/y
      if data.first.is_a?(Hash) && data.first.key?(:x)
        data
      # If array of values, use index as x
      elsif data.first.is_a?(Numeric)
        data.each_with_index.map { |v, i| { x: i.to_f, y: v.to_f } }
      # If array of hashes with date/value
      elsif data.first.is_a?(Hash) && (data.first.key?(:date) || data.first.key?(:value))
        data.each_with_index.map { |d, i| { x: i.to_f, y: (d[:value] || d[:observed_value] || 0).to_f } }
      else
        []
      end
    end

    def calculate_regression
      n = @data_points.size.to_f
      return if n < 2

      sum_x = @data_points.sum { |p| p[:x] }
      sum_y = @data_points.sum { |p| p[:y] }
      sum_xy = @data_points.sum { |p| p[:x] * p[:y] }
      sum_x2 = @data_points.sum { |p| p[:x] ** 2 }
      sum_y2 = @data_points.sum { |p| p[:y] ** 2 }

      # Calculate slope and intercept
      denominator = (n * sum_x2) - (sum_x ** 2)
      return if denominator.zero?

      @slope = ((n * sum_xy) - (sum_x * sum_y)) / denominator
      @intercept = (sum_y - (@slope * sum_x)) / n

      # Calculate R-squared
      mean_y = sum_y / n
      ss_tot = @data_points.sum { |p| (p[:y] - mean_y) ** 2 }
      ss_res = @data_points.sum { |p| (p[:y] - (@intercept + @slope * p[:x])) ** 2 }

      @r_squared = ss_tot > 0 ? 1 - (ss_res / ss_tot) : 0
    end

    class << self
      # Predict latency trend for an endpoint
      def predict_latency(endpoint: nil, days_history: 14, days_ahead: 7)
        data = fetch_latency_history(endpoint, days_history)
        return nil if data.size < 3

        predictor = new(data)
        prediction = predictor.predict(days_ahead: days_ahead)

        return nil unless prediction

        # Add context
        current_value = data.last[:value]
        prediction.merge(
          current_value: current_value,
          change_percent: ((prediction[:predicted_value] - current_value) / current_value * 100).round(1),
          endpoint: endpoint || "global"
        )
      end

      # Predict error budget exhaustion for an SLO
      def predict_slo_budget(slo, days_history: 30)
        snapshots = slo.snapshots
          .where("snapshot_date >= ?", days_history.days.ago)
          .order(:snapshot_date)
          .pluck(:error_budget_consumed)

        return nil if snapshots.size < 3

        predictor = new(snapshots)
        predictor.predict_threshold_crossing(100, direction: :above)
      end

      private

      def fetch_latency_history(endpoint, days)
        scope = PerformanceRequest.where("created_at >= ?", days.days.ago)
        scope = scope.where(endpoint: endpoint) if endpoint

        scope
          .group(Arel.sql("DATE(created_at)"))
          .select(
            "DATE(created_at) as date",
            "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95"
          )
          .order(Arel.sql("DATE(created_at)"))
          .map { |r| { date: r.date, value: r.p95.to_f } }
      end
    end
  end
end
