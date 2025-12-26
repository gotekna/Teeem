# Weekly SSoT compliance audit job
# Checks all columns match current type definition versions
# Runs every Monday at 6am Brisbane time
class GoldStandardComplianceCheckJob < ApplicationJob
  queue_as :low

  def perform
    Rails.logger.info "[SSoT] Starting weekly Gold Standard compliance check..."

    # Get overall system summary
    summary = GoldStandardComplianceService.system_summary

    # Log results
    Rails.logger.info "[SSoT] Compliance Summary:"
    Rails.logger.info "  Total Foundations: #{summary[:total_foundations]}"
    Rails.logger.info "  Total Columns: #{summary[:total_columns]}"
    Rails.logger.info "  Compliant Columns: #{summary[:compliant_columns]}"
    Rails.logger.info "  Overall Score: #{summary[:overall_score]}%"

    # Check for low compliance
    if summary[:overall_score] < 95
      Rails.logger.warn "[SSoT] WARNING: Compliance score below 95% (#{summary[:overall_score]}%)"

      # List non-compliant foundations
      summary[:foundations_needing_attention].each do |f|
        Rails.logger.warn "[SSoT]   - #{f[:name]} (ID: #{f[:id]}): #{f[:score]}%"
      end

      # Could add Sentry alert here if needed
    else
      Rails.logger.info "[SSoT] All foundations above 95% compliance threshold"
    end

    # Return summary for logging
    summary
  rescue => e
    Rails.logger.error "[SSoT] Compliance check failed: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    raise
  end
end
