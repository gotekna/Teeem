# frozen_string_literal: true

# CorporateXeroSyncJob
#
# Syncs Xero data (Monthly P&L, Accounts, Invoices) to local database for all
# Xero-connected corporate companies. Runs daily to keep data fresh.
#
# SSoT: CorporateXeroSyncService handles the actual sync logic.
#
# Rate Limit Handling (Jan 2026):
# - Pre-flight lockout check before processing
# - Checks XeroRateLimitTracker.should_throttle? BEFORE each company
# - Breaks early if approaching limits, schedules continuation
# - Catches XeroApiClient::RateLimitError and records lockout
#
# Schedule: Daily at 6:00 AM Brisbane time (via recurring.yml)
#
class CorporateXeroSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :low

  # @param options [Hash] Optional configuration
  #   - :company_ids [Array<Integer>] Specific company IDs to sync (default: all connected)
  #   - :data_types [Array<String>] Which data to sync: ['monthly_pl', 'accounts', 'invoices']
  #   - :force [Boolean] Force sync even if recently synced
  #   - :start_from_company_id [Integer] Resume from this company ID (for continuation)
  def perform(options = {})
    options = options.with_indifferent_access
    force = options[:force] || false
    data_types = options[:data_types] || %w[monthly_pl accounts invoices]
    start_from = options[:start_from_company_id]

    Rails.logger.info("[CorporateXeroSyncJob] Starting sync for: #{data_types.join(', ')}")

    result = {
      companies_processed: 0,
      monthly_pl_synced: 0,
      accounts_synced: 0,
      invoices_synced: 0,
      skipped: 0,
      skipped_rate_limit: 0,
      errors: [],
      rate_limited: false,
      continuation_scheduled: false
    }

    # Get companies to process
    companies = fetch_companies(options[:company_ids])
    companies = companies.where("corporate_companies.id >= ?", start_from) if start_from.present?
    Rails.logger.info("[CorporateXeroSyncJob] Found #{companies.count} companies to sync")

    companies.each do |company|
      tenant_id = company.corporate_xero_connection&.xero_tenant_id

      # SSoT: Check for Xero-enforced lockout before processing each company
      if tenant_id.present? && XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?
        lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
        Rails.logger.warn("[CorporateXeroSyncJob] Tenant #{tenant_id} locked out for #{lockout_remaining}s, scheduling continuation")
        schedule_continuation(options, company.id, lockout_remaining + 60)
        result[:rate_limited] = true
        result[:continuation_scheduled] = true
        break
      end

      # SSoT: Check if approaching rate limits before heavy operations
      if tenant_id.present? && XeroRateLimitTracker.should_throttle?(tenant_id)
        Rails.logger.warn("[CorporateXeroSyncJob] Approaching rate limit for tenant #{tenant_id}, scheduling continuation")
        schedule_continuation(options, company.id, 5 * 60) # Wait 5 minutes
        result[:rate_limited] = true
        result[:continuation_scheduled] = true
        break
      end

      begin
        sync_company(company, data_types, force, result)
      rescue XeroApiClient::RateLimitError => e
        handle_rate_limit_error(tenant_id, e, options, company.id, result)
        break
      end
    end

    Rails.logger.info("[CorporateXeroSyncJob] Completed: #{result.inspect}")
    result
  end

  private

  def fetch_companies(company_ids = nil)
    scope = Corporate.includes(:corporate_xero_connection)
                            .joins(:corporate_xero_connection)
                            .where.not(corporate_xero_connections: { xero_credential_id: nil })

    scope = scope.where(id: company_ids) if company_ids.present?
    scope.order(:name)
  end

  def sync_company(company, data_types, force, result)
    connection = company.corporate_xero_connection
    return unless connection&.connected?

    Rails.logger.info("[CorporateXeroSyncJob] Syncing #{company.name}...")

    sync_service = CorporateXeroSyncService.new(company)

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

  # Schedule a continuation job to resume from a specific company
  def schedule_continuation(options, start_from_company_id, wait_seconds)
    continuation_options = options.merge(start_from_company_id: start_from_company_id)
    Rails.logger.info("[CorporateXeroSyncJob] Scheduling continuation from company #{start_from_company_id} in #{wait_seconds}s")
    self.class.set(wait: wait_seconds.seconds).perform_later(continuation_options)
  end

  # Handle rate limit errors by recording lockout and scheduling continuation
  def handle_rate_limit_error(tenant_id, error, options, company_id, result)
    retry_after = extract_retry_after(error.message)
    XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id) if tenant_id.present?

    Rails.logger.warn("[CorporateXeroSyncJob] RATE LIMITED - Scheduling continuation in #{retry_after + 60}s")
    result[:rate_limited] = true
    result[:errors] << { tenant_id: tenant_id, error: "Rate limited by Xero", retry_after: retry_after }

    # Schedule continuation from current company after lockout expires
    schedule_continuation(options, company_id, retry_after + 60)
    result[:continuation_scheduled] = true
  end

  # Extract retry_after seconds from RateLimitError message
  def extract_retry_after(message)
    match = message.to_s.match(/retry after (\d+)/i)
    match ? match[1].to_i : 3600  # Default 1 hour if not parseable
  end
end
