# frozen_string_literal: true

module Performance
  # Budget Validator - Validates performance against configured budgets
  #
  # Reads budgets from config/performance_budgets.yml (SSoT) and validates
  # actual performance metrics against targets.
  #
  # Usage:
  #   Performance::BudgetValidator.validate_endpoint("/api/v1/jobs")
  #   Performance::BudgetValidator.validate_all
  #   Performance::BudgetValidator.budget_for("/api/v1/jobs")
  #
  class BudgetValidator
    CONFIG_PATH = Rails.root.join("config", "performance_budgets.yml")

    class << self
      # Load and cache the budget configuration
      def config
        @config ||= load_config
      end

      # Reload configuration (useful after changes)
      def reload!
        @config = nil
        @endpoint_matchers = nil
        config
      end

      # Get budget for a specific endpoint
      def budget_for(endpoint)
        # Try exact match first
        budget = config.dig("endpoints", endpoint)
        return budget.merge("endpoint" => endpoint, "match_type" => "exact") if budget

        # Try pattern matching
        config["endpoints"]&.each do |pattern, budget_config|
          next unless pattern.include?(":") || pattern.include?("*")

          if endpoint_matches?(endpoint, pattern)
            return budget_config.merge("endpoint" => pattern, "match_type" => "pattern")
          end
        end

        # Return global defaults
        config.dig("global", "api")&.merge("endpoint" => "global", "match_type" => "default")
      end

      # Get page budget
      def page_budget_for(path)
        budget = config.dig("pages", path)
        return budget.merge("page" => path, "match_type" => "exact") if budget

        # Try pattern matching
        config["pages"]&.each do |pattern, budget_config|
          next unless pattern.include?(":") || pattern.include?("*")

          if endpoint_matches?(path, pattern)
            return budget_config.merge("page" => pattern, "match_type" => "pattern")
          end
        end

        config.dig("global", "vitals")&.merge("page" => "global", "match_type" => "default")
      end

      # Validate a specific endpoint against its budget
      def validate_endpoint(endpoint, since: 1.hour.ago)
        budget = budget_for(endpoint)
        return nil unless budget

        # Get actual metrics
        metrics = PerformanceRequest
          .where("created_at > ?", since)
          .where(endpoint: endpoint)

        total = metrics.count
        return { endpoint: endpoint, status: :no_data, sample_size: 0 } if total < 10

        stats = metrics.latency_stats
        error_count = metrics.errors.count
        error_rate = (error_count.to_f / total * 100).round(3)

        violations = []

        # Check P95
        if budget["p95_target_ms"] && stats[:p95] && stats[:p95] > budget["p95_target_ms"]
          violations << {
            metric: "p95",
            target: budget["p95_target_ms"],
            actual: stats[:p95],
            severity: calculate_severity(stats[:p95], budget["p95_target_ms"])
          }
        end

        # Check P99
        if budget["p99_target_ms"] && stats[:p99] && stats[:p99] > budget["p99_target_ms"]
          violations << {
            metric: "p99",
            target: budget["p99_target_ms"],
            actual: stats[:p99],
            severity: calculate_severity(stats[:p99], budget["p99_target_ms"])
          }
        end

        # Check error rate
        max_error = (budget["error_rate_max"] || 0.01) * 100
        if error_rate > max_error
          violations << {
            metric: "error_rate",
            target: max_error,
            actual: error_rate,
            severity: calculate_severity(error_rate, max_error)
          }
        end

        {
          endpoint: endpoint,
          budget: budget,
          status: violations.empty? ? :pass : :fail,
          sample_size: total,
          metrics: {
            p50: stats[:p50],
            p95: stats[:p95],
            p99: stats[:p99],
            error_rate: error_rate
          },
          violations: violations
        }
      end

      # Validate all configured endpoints
      def validate_all(since: 1.hour.ago)
        results = []

        # Get all unique endpoints from recent requests
        endpoints = PerformanceRequest
          .where("created_at > ?", since)
          .distinct
          .pluck(:endpoint)

        endpoints.each do |endpoint|
          result = validate_endpoint(endpoint, since: since)
          results << result if result
        end

        # Sort by status (failures first) then by endpoint
        results.sort_by { |r| [r[:status] == :fail ? 0 : 1, r[:endpoint]] }
      end

      # Get summary of budget compliance
      def compliance_summary(since: 24.hours.ago)
        results = validate_all(since: since)

        total = results.count
        passing = results.count { |r| r[:status] == :pass }
        failing = results.count { |r| r[:status] == :fail }
        no_data = results.count { |r| r[:status] == :no_data }

        critical_violations = results
          .select { |r| r[:status] == :fail }
          .flat_map { |r| r[:violations].select { |v| v[:severity] == :critical } }

        {
          total_endpoints: total,
          passing: passing,
          failing: failing,
          no_data: no_data,
          compliance_percent: total > 0 ? (passing.to_f / (total - no_data) * 100).round(1) : 100,
          critical_violations: critical_violations.size,
          top_violations: results
            .select { |r| r[:status] == :fail }
            .sort_by { |r| -r[:violations].map { |v| v[:actual].to_f / v[:target].to_f }.max }
            .first(5)
            .map { |r| { endpoint: r[:endpoint], violations: r[:violations] } }
        }
      end

      # List all configured budgets
      def all_budgets
        budgets = []

        config["endpoints"]&.each do |endpoint, budget|
          budgets << budget.merge("type" => "endpoint", "path" => endpoint)
        end

        config["pages"]&.each do |page, budget|
          budgets << budget.merge("type" => "page", "path" => page)
        end

        budgets
      end

      private

      def load_config
        return {} unless File.exist?(CONFIG_PATH)

        YAML.load_file(CONFIG_PATH) || {}
      rescue => e
        Rails.logger.error "[BudgetValidator] Failed to load config: #{e.message}"
        {}
      end

      def endpoint_matches?(endpoint, pattern)
        # Convert Rails-style route patterns to regex
        regex_pattern = pattern
          .gsub(/:[\w]+/, '[^/]+')  # :id -> match any segment
          .gsub(/\*$/, '.*')         # /* -> match anything
          .gsub(/\*/, '[^/]*')       # * in middle -> match segment

        Regexp.new("^#{regex_pattern}$").match?(endpoint)
      end

      def calculate_severity(actual, target)
        ratio = actual.to_f / target.to_f

        if ratio >= 2.0
          :critical
        elsif ratio >= 1.5
          :warning
        else
          :info
        end
      end
    end
  end
end
