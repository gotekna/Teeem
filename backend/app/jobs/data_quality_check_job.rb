# Job to run data quality checks on warehouse views
# Runs after materialized view refreshes to catch issues early
class DataQualityCheckJob < ApplicationJob
  queue_as :low

  # Run quality checks
  # @param view_name [String, nil] - specific view to check, or nil for all views
  def perform(view_name = nil)
    checker = DataQualityChecker.new

    if view_name
      checks = DataQualityChecker::VIEW_CHECKS[view_name]
      if checks
        checker.run_checks_for_view(view_name, checks)
      else
        Rails.logger.warn("[DataQuality] No checks configured for view: #{view_name}")
        return
      end
    else
      checker.run_all_checks
    end

    results = checker.results
    issues_found = results.count { |r| r[:issue_reported] }

    Rails.logger.info("[DataQuality] Completed #{results.count} checks, found #{issues_found} issues")

    # Return results for monitoring
    {
      checked_at: Time.current,
      total_checks: results.count,
      issues_found: issues_found,
      results: results
    }
  end
end
