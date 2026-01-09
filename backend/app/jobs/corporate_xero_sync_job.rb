# frozen_string_literal: true

# CorporateXeroSyncJob
#
# Syncs Xero data (Monthly P&L, Accounts, Invoices) to local database for all
# Xero-connected corporate companies. Runs daily to keep data fresh.
#
# SSoT: CorporateCompanyXeroSyncService handles the actual sync logic.
#
# Schedule: Daily at 6:00 AM Brisbane time (via recurring.yml)
#
class CorporateXeroSyncJob < ApplicationJob
  queue_as :low

  # @param options [Hash] Optional configuration
  #   - :company_ids [Array<Integer>] Specific company IDs to sync (default: all connected)
  #   - :data_types [Array<String>] Which data to sync: ['monthly_pl', 'accounts', 'invoices']
  #   - :force [Boolean] Force sync even if recently synced
  def perform(options = {})
    options = options.with_indifferent_access
    force = options[:force] || false
    data_types = options[:data_types] || %w[monthly_pl accounts invoices]

    Rails.logger.info("[CorporateXeroSyncJob] Starting sync for: #{data_types.join(', ')}")

    result = {
      companies_processed: 0,
      monthly_pl_synced: 0,
      accounts_synced: 0,
      invoices_synced: 0,
      skipped: 0,
      errors: []
    }

    # Get companies to process
    companies = fetch_companies(options[:company_ids])
    Rails.logger.info("[CorporateXeroSyncJob] Found #{companies.count} companies to sync")

    companies.each do |company|
      sync_company(company, data_types, force, result)
    end

    Rails.logger.info("[CorporateXeroSyncJob] Completed: #{result.inspect}")
    result
  end

  private

  def fetch_companies(company_ids = nil)
    scope = CorporateCompany.includes(:corporate_company_xero_connection)
                            .joins(:corporate_company_xero_connection)
                            .where.not(corporate_company_xero_connections: { xero_credential_id: nil })

    scope = scope.where(id: company_ids) if company_ids.present?
    scope.order(:name)
  end

  def sync_company(company, data_types, force, result)
    connection = company.corporate_company_xero_connection
    return unless connection&.connected?

    Rails.logger.info("[CorporateXeroSyncJob] Syncing #{company.name}...")

    sync_service = CorporateCompanyXeroSyncService.new(company)

    # Sync Monthly P&L
    if data_types.include?("monthly_pl")
      pl_result = sync_service.sync_monthly_pl(force: force)
      if pl_result[:success] && !pl_result[:skipped]
        result[:monthly_pl_synced] += 1
      elsif pl_result[:skipped]
        result[:skipped] += 1
      end
    end

    # Sync Chart of Accounts
    if data_types.include?("accounts")
      acc_result = sync_service.sync_accounts(force: force)
      if acc_result[:success] && !acc_result[:skipped]
        result[:accounts_synced] += 1
      elsif acc_result[:skipped]
        result[:skipped] += 1
      end
    end

    # Sync Invoices
    if data_types.include?("invoices")
      inv_result = sync_service.sync_invoices(force: force)
      if inv_result[:success] && !inv_result[:skipped]
        result[:invoices_synced] += 1
      elsif inv_result[:skipped]
        result[:skipped] += 1
      end
    end

    result[:companies_processed] += 1
  rescue StandardError => e
    result[:errors] << { company_id: company.id, company_name: company.name, error: e.message }
    Rails.logger.error("[CorporateXeroSyncJob] Error syncing #{company.name}: #{e.message}")
  end
end
