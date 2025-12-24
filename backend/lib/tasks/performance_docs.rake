# frozen_string_literal: true

namespace :performance do
  desc "Generate performance budget documentation from config/performance_budgets.yml"
  task generate_docs: :environment do
    output_path = Rails.root.join("..", "TEEEM_DOCS", "PERFORMANCE_BUDGETS.md")

    # Ensure directory exists
    FileUtils.mkdir_p(File.dirname(output_path))

    content = generate_documentation
    File.write(output_path, content)

    puts "Generated: #{output_path}"
  end

  desc "Validate all endpoints against their performance budgets"
  task validate: :environment do
    summary = Performance::BudgetValidator.compliance_summary

    puts "\n" + "=" * 60
    puts "PERFORMANCE BUDGET VALIDATION"
    puts "=" * 60
    puts "\nCompliance: #{summary[:compliance_percent]}%"
    puts "Passing: #{summary[:passing]} / #{summary[:total_endpoints] - summary[:no_data]}"
    puts "Failing: #{summary[:failing]}"
    puts "Critical Violations: #{summary[:critical_violations]}"

    if summary[:top_violations].any?
      puts "\nTop Violations:"
      summary[:top_violations].each do |v|
        puts "  #{v[:endpoint]}:"
        v[:violations].each do |viol|
          puts "    - #{viol[:metric]}: #{viol[:actual]} (target: #{viol[:target]}) [#{viol[:severity]}]"
        end
      end
    end

    puts "=" * 60 + "\n"

    # Exit with error code if critical violations
    exit(1) if summary[:critical_violations] > 0
  end

  def generate_documentation
    config = Performance::BudgetValidator.config

    <<~MD
      # Performance Budgets

      > **Auto-generated from `config/performance_budgets.yml`**
      >
      > Last updated: #{Time.current.strftime("%Y-%m-%d %H:%M")} Brisbane time
      >
      > This document is automatically generated. Do not edit directly.
      > To update budgets, modify `config/performance_budgets.yml` and run:
      > ```bash
      > bundle exec rails performance:generate_docs
      > ```

      ## Overview

      Performance budgets define acceptable latency and error thresholds for TEEEM's
      API endpoints and frontend pages. These targets are:

      - **Enforced** via the Performance Observatory dashboard
      - **Monitored** via automated anomaly detection
      - **Validated** in CI/CD pipelines (coming soon)

      ## Global Defaults

      Any endpoint or page not explicitly configured uses these defaults:

      ### API Endpoints

      | Metric | Target |
      |--------|--------|
      | P95 Response Time | #{config.dig("global", "api", "p95_target_ms")}ms |
      | P99 Response Time | #{config.dig("global", "api", "p99_target_ms")}ms |
      | Error Rate | #{(config.dig("global", "api", "error_rate_max") || 0.01) * 100}% |

      ### Web Vitals

      | Metric | Target | Description |
      |--------|--------|-------------|
      | LCP | #{config.dig("global", "vitals", "lcp_target_ms")}ms | Largest Contentful Paint |
      | CLS | #{config.dig("global", "vitals", "cls_target")} | Cumulative Layout Shift |
      | INP | #{config.dig("global", "vitals", "inp_target_ms")}ms | Interaction to Next Paint |
      | TTFB | #{config.dig("global", "vitals", "ttfb_target_ms")}ms | Time to First Byte |

      ## API Endpoint Budgets

      #{generate_endpoint_table(config["endpoints"])}

      ## Frontend Page Budgets

      #{generate_page_table(config["pages"])}

      ## Critical User Journeys

      #{generate_journey_docs(config["journeys"])}

      ## Alerting Thresholds

      | Threshold | Value | Description |
      |-----------|-------|-------------|
      | Warning | #{(config.dig("alerting", "warning_threshold") || 0.8) * 100}% of budget | Approaching limit |
      | Critical | #{(config.dig("alerting", "critical_threshold") || 1.0) * 100}% of budget | Exceeding limit |
      | Min Samples | #{config.dig("alerting", "min_sample_size") || 100} | Before alerting |
      | Window | #{config.dig("alerting", "evaluation_window_minutes") || 60} min | Evaluation period |

      ## How to Add New Budgets

      1. Edit `backend/config/performance_budgets.yml`
      2. Add your endpoint/page under the appropriate section
      3. Run `bundle exec rails performance:generate_docs`
      4. Commit both the YAML and generated docs

      ### Example Endpoint Budget

      ```yaml
      endpoints:
        "/api/v1/my-endpoint":
          p95_target_ms: 200
          p99_target_ms: 400
          error_rate_max: 0.01
          owner: my_team
          description: "My endpoint description"
      ```

      ### Example Page Budget

      ```yaml
      pages:
        "/my-page":
          lcp_target_ms: 2500
          cls_target: 0.1
          inp_target_ms: 200
          owner: frontend_team
          description: "My page description"
      ```

      ## Validation

      Run budget validation locally:

      ```bash
      bundle exec rails performance:validate
      ```

      This will check all endpoints against their budgets and exit with an error
      if any critical violations are found.
    MD
  end

  def generate_endpoint_table(endpoints)
    return "_No custom endpoint budgets configured._" if endpoints.blank?

    rows = endpoints.map do |path, budget|
      p95 = budget["p95_target_ms"] || "-"
      p99 = budget["p99_target_ms"] || "-"
      error = budget["error_rate_max"] ? "#{(budget["error_rate_max"] * 100).round(2)}%" : "-"
      owner = budget["owner"] || "-"
      desc = budget["description"] || "-"

      "| `#{path}` | #{p95}ms | #{p99}ms | #{error} | #{owner} | #{desc} |"
    end

    <<~TABLE
      | Endpoint | P95 | P99 | Error Rate | Owner | Description |
      |----------|-----|-----|------------|-------|-------------|
      #{rows.join("\n")}
    TABLE
  end

  def generate_page_table(pages)
    return "_No custom page budgets configured._" if pages.blank?

    rows = pages.map do |path, budget|
      lcp = budget["lcp_target_ms"] || "-"
      cls = budget["cls_target"] || "-"
      inp = budget["inp_target_ms"] || "-"
      owner = budget["owner"] || "-"
      desc = budget["description"] || "-"

      "| `#{path}` | #{lcp}ms | #{cls} | #{inp}ms | #{owner} | #{desc} |"
    end

    <<~TABLE
      | Page | LCP | CLS | INP | Owner | Description |
      |------|-----|-----|-----|-------|-------------|
      #{rows.join("\n")}
    TABLE
  end

  def generate_journey_docs(journeys)
    return "_No user journeys configured._" if journeys.blank?

    journeys.map do |name, journey|
      steps_table = journey["steps"]&.map do |step|
        "| #{step["name"]} | #{step["budget_ms"]}ms |"
      end&.join("\n")

      <<~JOURNEY
        ### #{name.titleize}

        #{journey["description"]}

        **Total Budget:** #{journey["total_budget_ms"]}ms

        | Step | Budget |
        |------|--------|
        #{steps_table}
      JOURNEY
    end.join("\n")
  end
end
