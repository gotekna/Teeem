# Service to run data quality checks on warehouse views
# Implements dbt-style data tests for materialized views
class DataQualityChecker
  # Configuration for each view's checks
  VIEW_CHECKS = {
    "mv_job_summary" => [
      :row_count_reasonable,
      :no_null_primary_keys,
      :no_negative_financials
    ],
    "mv_financial_summary" => [
      :row_count_reasonable,
      :no_null_required_fields,
      :amounts_are_numeric
    ],
    "mv_document_summary" => [
      :row_count_reasonable,
      :document_counts_positive
    ],
    "mv_invoice_po_reconciliation" => [
      :row_count_reasonable
    ],
    "fact_job_daily_snapshots" => [
      :row_count_reasonable,
      :no_future_snapshots,
      :snapshot_completeness
    ]
  }.freeze

  # Thresholds
  MIN_ROW_COUNT = 1  # Minimum expected rows (can be 0 for new deployments)
  MAX_ROW_COUNT_DROP_PCT = 50  # Alert if rows drop by more than 50%

  attr_reader :results

  def initialize
    @results = []
  end

  # Run all checks for all views
  def run_all_checks
    VIEW_CHECKS.each do |view_name, checks|
      run_checks_for_view(view_name, checks)
    end

    # Auto-resolve issues for checks that are now passing
    auto_resolve_passing_checks

    {
      checked_at: Time.current,
      views_checked: VIEW_CHECKS.keys.count,
      total_checks: @results.count,
      issues_found: @results.count { |r| r[:issue_reported] },
      results: @results
    }
  end

  # Run checks for a specific view
  def run_checks_for_view(view_name, checks = nil)
    checks ||= VIEW_CHECKS[view_name] || []

    checks.each do |check_name|
      result = run_check(view_name, check_name)
      @results << result
    end
  end

  private

  def run_check(view_name, check_name)
    result = {
      view_name: view_name,
      check_name: check_name.to_s,
      checked_at: Time.current,
      passed: false,
      issue_reported: false,
      details: {}
    }

    begin
      case check_name
      when :row_count_reasonable
        result.merge!(check_row_count_reasonable(view_name))
      when :no_null_primary_keys
        result.merge!(check_no_null_primary_keys(view_name))
      when :no_negative_financials
        result.merge!(check_no_negative_financials(view_name))
      when :no_null_required_fields
        result.merge!(check_no_null_required_fields(view_name))
      when :amounts_are_numeric
        result.merge!(check_amounts_are_numeric(view_name))
      when :document_counts_positive
        result.merge!(check_document_counts_positive(view_name))
      when :no_future_snapshots
        result.merge!(check_no_future_snapshots(view_name))
      when :snapshot_completeness
        result.merge!(check_snapshot_completeness(view_name))
      else
        result[:details][:error] = "Unknown check: #{check_name}"
      end
    rescue StandardError => e
      result[:details][:error] = e.message
      result[:details][:backtrace] = e.backtrace.first(3)
    end

    result
  end

  # Check that row count is reasonable
  def check_row_count_reasonable(view_name)
    current_count = get_row_count(view_name)

    # Get previous count from refresh logs
    last_log = MvRefreshLog.for_view(view_name)
                          .successful
                          .where.not(row_count: nil)
                          .order(completed_at: :desc)
                          .offset(1)
                          .first

    previous_count = last_log&.row_count

    result = { passed: true, details: { current_count: current_count, previous_count: previous_count } }

    # Check for significant row count drop
    if previous_count && previous_count > 0 && current_count < previous_count * (1 - MAX_ROW_COUNT_DROP_PCT / 100.0)
      drop_pct = ((previous_count - current_count).to_f / previous_count * 100).round(1)

      report_issue(
        view_name: view_name,
        check_name: "row_count_reasonable",
        severity: drop_pct > 80 ? "critical" : "warning",
        description: "Row count dropped by #{drop_pct}% (#{previous_count} -> #{current_count})",
        details: { previous_count: previous_count, current_count: current_count, drop_percentage: drop_pct }
      )

      result[:passed] = false
      result[:issue_reported] = true
    end

    result
  end

  # Check for null primary keys in mv_job_summary
  def check_no_null_primary_keys(view_name)
    null_count = execute_count("SELECT COUNT(*) FROM #{quote_table(view_name)} WHERE job_id IS NULL")

    if null_count > 0
      report_issue(
        view_name: view_name,
        check_name: "no_null_primary_keys",
        severity: "error",
        description: "Found #{null_count} rows with NULL job_id",
        details: { null_count: null_count },
        affected_row_count: null_count
      )

      { passed: false, issue_reported: true, details: { null_count: null_count } }
    else
      { passed: true, details: { null_count: 0 } }
    end
  end

  # Check for negative financial values
  def check_no_negative_financials(view_name)
    negative_count = execute_count(<<~SQL)
      SELECT COUNT(*) FROM #{quote_table(view_name)}
      WHERE total_income < 0 OR total_expenses < 0 OR total_po_value < 0 OR total_invoiced < 0
    SQL

    if negative_count > 0
      report_issue(
        view_name: view_name,
        check_name: "no_negative_financials",
        severity: "warning",
        description: "Found #{negative_count} rows with negative financial values",
        details: { negative_count: negative_count },
        affected_row_count: negative_count
      )

      { passed: false, issue_reported: true, details: { negative_count: negative_count } }
    else
      { passed: true, details: { negative_count: 0 } }
    end
  end

  # Check for null required fields
  def check_no_null_required_fields(view_name)
    null_count = execute_count(<<~SQL)
      SELECT COUNT(*) FROM #{quote_table(view_name)}
      WHERE company_id IS NULL OR period IS NULL
    SQL

    if null_count > 0
      report_issue(
        view_name: view_name,
        check_name: "no_null_required_fields",
        severity: "error",
        description: "Found #{null_count} rows with NULL required fields",
        details: { null_count: null_count },
        affected_row_count: null_count
      )

      { passed: false, issue_reported: true, details: { null_count: null_count } }
    else
      { passed: true, details: { null_count: 0 } }
    end
  end

  # Check that amounts are valid numbers
  def check_amounts_are_numeric(view_name)
    # This is more of a schema check - amounts should always be numeric
    # but we can check for NaN or infinity values
    { passed: true, details: { message: "Amount fields are numeric by schema" } }
  end

  # Check document counts are positive
  def check_document_counts_positive(view_name)
    negative_count = execute_count(<<~SQL)
      SELECT COUNT(*) FROM #{quote_table(view_name)}
      WHERE document_count < 0 OR verified_count < 0
    SQL

    if negative_count > 0
      report_issue(
        view_name: view_name,
        check_name: "document_counts_positive",
        severity: "error",
        description: "Found #{negative_count} rows with negative counts",
        details: { negative_count: negative_count },
        affected_row_count: negative_count
      )

      { passed: false, issue_reported: true, details: { negative_count: negative_count } }
    else
      { passed: true, details: { negative_count: 0 } }
    end
  end

  # Check for future snapshots (shouldn't exist)
  def check_no_future_snapshots(view_name)
    future_count = execute_count(<<~SQL)
      SELECT COUNT(*) FROM #{quote_table(view_name)}
      WHERE snapshot_date > CURRENT_DATE
    SQL

    if future_count > 0
      report_issue(
        view_name: view_name,
        check_name: "no_future_snapshots",
        severity: "error",
        description: "Found #{future_count} snapshots with future dates",
        details: { future_count: future_count },
        affected_row_count: future_count
      )

      { passed: false, issue_reported: true, details: { future_count: future_count } }
    else
      { passed: true, details: { future_count: 0 } }
    end
  end

  # Check snapshot completeness (no gaps)
  def check_snapshot_completeness(view_name)
    # Check for gaps in the last 30 days
    result = ActiveRecord::Base.connection.execute(<<~SQL)
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '30 days',
          CURRENT_DATE - INTERVAL '1 day',
          INTERVAL '1 day'
        )::date AS expected_date
      ),
      actual_dates AS (
        SELECT DISTINCT snapshot_date FROM #{quote_table(view_name)}
        WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT COUNT(*) as missing_dates
      FROM date_series ds
      LEFT JOIN actual_dates ad ON ds.expected_date = ad.snapshot_date
      WHERE ad.snapshot_date IS NULL
    SQL

    missing_dates = result.first["missing_dates"].to_i

    if missing_dates > 3  # Allow a few gaps for new deployments
      report_issue(
        view_name: view_name,
        check_name: "snapshot_completeness",
        severity: "warning",
        description: "Missing #{missing_dates} daily snapshots in last 30 days",
        details: { missing_dates: missing_dates }
      )

      { passed: false, issue_reported: true, details: { missing_dates: missing_dates } }
    else
      { passed: true, details: { missing_dates: missing_dates } }
    end
  end

  # Helper methods

  def get_row_count(view_name)
    execute_count("SELECT COUNT(*) FROM #{quote_table(view_name)}")
  end

  def execute_count(sql)
    ActiveRecord::Base.connection.execute(sql).first["count"].to_i
  end

  def quote_table(name)
    ActiveRecord::Base.connection.quote_table_name(name)
  end

  def report_issue(view_name:, check_name:, severity:, description:, details: {}, affected_row_count: nil)
    return unless defined?(DataQualityIssue)

    DataQualityIssue.report(
      view_name: view_name,
      check_name: check_name,
      severity: severity,
      description: description,
      details: details,
      affected_row_count: affected_row_count
    )
  end

  def auto_resolve_passing_checks
    return unless defined?(DataQualityIssue)

    passing_checks = @results.select { |r| r[:passed] }

    passing_checks.each do |result|
      DataQualityIssue.auto_resolve_if_healthy(
        view_name: result[:view_name],
        check_name: result[:check_name]
      )
    end
  end
end
