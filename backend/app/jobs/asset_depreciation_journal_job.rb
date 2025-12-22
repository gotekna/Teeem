# World-Class Asset Register - Monthly Depreciation Journal Job
# Posts depreciation journals to Xero for all connected companies
class AssetDepreciationJournalJob < ApplicationJob
  queue_as :low

  def perform
    Rails.logger.info "[AssetDepreciationJournalJob] Starting monthly depreciation journal posting"

    # Use previous month (since we run on the 5th)
    date = Date.current.prev_month
    month = date.month
    year = date.year

    Rails.logger.info "[AssetDepreciationJournalJob] Posting for #{Date::MONTHNAMES[month]} #{year}"

    results = XeroAssetJournalService.post_monthly_depreciation(month, year)

    Rails.logger.info "[AssetDepreciationJournalJob] Completed: #{results[:success]} succeeded, #{results[:failed]} failed"

    if results[:errors].any?
      Rails.logger.warn "[AssetDepreciationJournalJob] Errors: #{results[:errors].inspect}"
    end

    results
  end
end
