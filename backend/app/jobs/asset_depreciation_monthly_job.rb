# World-Class Asset Register - Monthly Depreciation Calculation Job
# Calculates depreciation for all assets for the current financial year
class AssetDepreciationMonthlyJob < ApplicationJob
  queue_as :low

  def perform
    Rails.logger.info "[AssetDepreciationMonthlyJob] Starting monthly depreciation calculation"

    # Get current financial year
    current_fy = AssetDepreciationSchedule.current_financial_year

    # Calculate depreciation for all depreciable assets
    results = AssetDepreciationService.calculate_all_for_year(current_fy)

    Rails.logger.info "[AssetDepreciationMonthlyJob] Completed: #{results[:success]} succeeded, #{results[:failed]} failed"

    if results[:errors].any?
      Rails.logger.warn "[AssetDepreciationMonthlyJob] Errors: #{results[:errors].inspect}"
    end

    results
  end
end
