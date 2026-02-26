# World-Class Asset Register - Monthly Depreciation Calculation Job
# Calculates depreciation for all assets for the current financial year
class AssetDepreciationMonthlyJob < ApplicationJob
  include DeduplicatableJob
  queue_as :low

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: Asset has acts_as_tenant. AssetDepreciationService.calculate_all_for_year
  # queries Asset.depreciable without tenant context, processing ALL tenants' assets
  # together and creating cross-tenant depreciation schedules.
  def perform
    Rails.logger.info "[AssetDepreciationMonthlyJob] Starting monthly depreciation calculation"

    # Get current financial year
    current_fy = AssetDepreciationSchedule.current_financial_year

    all_results = { success: 0, failed: 0, errors: [] }

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        results = AssetDepreciationService.calculate_all_for_year(current_fy)
        all_results[:success] += results[:success]
        all_results[:failed] += results[:failed]
        all_results[:errors].concat(results[:errors])
      end
    end

    Rails.logger.info "[AssetDepreciationMonthlyJob] Completed: #{all_results[:success]} succeeded, #{all_results[:failed]} failed"

    if all_results[:errors].any?
      Rails.logger.warn "[AssetDepreciationMonthlyJob] Errors: #{all_results[:errors].inspect}"
    end

    all_results
  end
end
