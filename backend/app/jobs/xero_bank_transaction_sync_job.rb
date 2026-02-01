# frozen_string_literal: true

# XeroBankTransactionSyncJob - Syncs bank transactions from Xero
#
# Rate Limit Handling (Jan 2026):
# - Pre-flight lockout check before processing each tenant
# - Checks rate limits before each paginated API request
# - Breaks pagination if approaching limits, schedules continuation
# - Catches XeroApiClient::RateLimitError and records lockout
#
class XeroBankTransactionSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :default

  # FRC (Jan 2026): Updated to sync ALL connected XeroCredentials, not just primary
  # Bug: Was only syncing primary + CorporateXeroConnection, missing 9 of 10 orgs
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)
    Rails.logger.info("Starting XeroBankTransactionSyncJob")

    result = {
      created: 0,
      updated: 0,
      errors: [],
      pages_fetched: 0,
      total_transactions: 0,
      tenants_synced: 0,
      tenants_skipped_lockout: 0,
      rate_limited: false
    }

    client = XeroApiClient.new

    # SSoT: Sync ALL connected Xero credentials (same pattern as XeroInvoiceSyncJob)
    credentials = XeroCredential.where(status: %w[connected degraded])

    if credentials.empty?
      Rails.logger.warn("[BankTransactionSync] No connected Xero credentials")
      return result
    end

    Rails.logger.info("[BankTransactionSync] Syncing #{credentials.count} connected tenants")

    credentials.each do |credential|
      tenant_id = credential.tenant_id

      # Pre-flight lockout check for each tenant
      if XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?
        lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
        Rails.logger.warn("[BankTransactionSync] Tenant #{credential.tenant_name} locked out for #{lockout_remaining}s, skipping")
        result[:tenants_skipped_lockout] += 1
        next
      end

      Rails.logger.info("[BankTransactionSync] Syncing: #{credential.tenant_name} (#{tenant_id})")
      tenant_result = sync_tenant_with_rate_limiting(client, tenant_id, result, options)
      result[:tenants_synced] += 1 if tenant_result[:success]

      # FRC (Jan 2026): Use `next` not `break` for multi-tenant isolation
      # If one tenant hits rate limit, continue to others
      if tenant_result[:rate_limited]
        result[:errors] << { tenant_id: tenant_id, error: "Rate limited" }
        next
      end
    end

    Rails.logger.info("XeroBankTransactionSyncJob completed: #{result.inspect}")
    result
  end

  private

  # Schedule retry after lockout expires
  def schedule_retry(options, wait_seconds)
    Rails.logger.info("[BankTransactionSync] Scheduling retry in #{wait_seconds}s")
    self.class.set(wait: wait_seconds.seconds).perform_later(options)
  end

  # Sync with rate limiting wrapper
  def sync_tenant_with_rate_limiting(client, tenant_id, result, options)
    begin
      sync_tenant(client, tenant_id, result)
    rescue XeroApiClient::RateLimitError => e
      handle_rate_limit_error(tenant_id, e, options)
      { success: false, rate_limited: true }
    end
  end

  # Sync bank transactions for a specific Xero tenant
  def sync_tenant(client, tenant_id, result)
    Rails.logger.info("[BankTransactionSync] Starting sync for tenant: #{tenant_id}")
    tenant_result = { success: false, created: 0, updated: 0, rate_limited: false }

    # Fetch all pages of bank transactions
    page = 1
    loop do
      # SSoT: Check rate limits before each paginated request
      if XeroRateLimitTracker.should_throttle?(tenant_id)
        Rails.logger.warn("[BankTransactionSync] Approaching rate limit, stopping pagination at page #{page}")
        tenant_result[:rate_limited] = true
        break
      end

      # Also check for lockout that might have been set by another job
      if XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?
        Rails.logger.warn("[BankTransactionSync] Lockout detected mid-sync, stopping pagination")
        tenant_result[:rate_limited] = true
        break
      end

      response = client.get("BankTransactions", { page: page, tenant_id: tenant_id })

      unless response[:success]
        result[:errors] << "API error for tenant #{tenant_id} on page #{page}: #{response[:error]}"
        break
      end

      transactions = response.dig(:data, "BankTransactions") || []
      break if transactions.empty?

      result[:pages_fetched] += 1
      result[:total_transactions] += transactions.count

      # Process each transaction
      transactions.each do |txn|
        process_result = process_transaction(txn, tenant_id)
        if process_result[:created]
          result[:created] += 1
          tenant_result[:created] += 1
        elsif process_result[:updated]
          result[:updated] += 1
          tenant_result[:updated] += 1
        elsif process_result[:error]
          result[:errors] << process_result[:error]
        end
      end

      # Check pagination
      pagination = response.dig(:data, "pagination")
      break if pagination.nil? || page >= pagination["pageCount"]

      page += 1

      # Small delay to spread requests
      sleep(0.5)
    end

    tenant_result[:success] = true unless tenant_result[:rate_limited]
    update_sync_status(tenant_result, tenant_id) unless tenant_result[:rate_limited]

    tenant_result
  rescue StandardError => e
    Rails.logger.error("[BankTransactionSync] Failed for tenant #{tenant_id}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    result[:errors] << "Tenant #{tenant_id}: #{e.message}"
    raise  # Re-raise to let wrapper handle rate limit errors
  end

  # Handle rate limit errors by recording lockout and scheduling retry
  def handle_rate_limit_error(tenant_id, error, options)
    retry_after = extract_retry_after(error.message)
    XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id)

    Rails.logger.warn("[BankTransactionSync] RATE LIMITED - Scheduling retry in #{retry_after + 60}s")
    XeroSyncStatus.fail_sync!("bank_transactions", tenant_id: tenant_id, error: "Rate limited by Xero - retry in #{retry_after}s")

    # Schedule retry after lockout expires
    schedule_retry(options, retry_after + 60)
  end

  # Extract retry_after seconds from RateLimitError message
  def extract_retry_after(message)
    match = message.to_s.match(/retry after (\d+)/i)
    match ? match[1].to_i : 3600  # Default 1 hour if not parseable
  end

  def process_transaction(txn, tenant_id)
    xero_id = txn["BankTransactionID"]
    return { error: "Missing BankTransactionID" } unless xero_id.present?

    # Skip deleted transactions
    return { skipped: true } if txn["Status"] == "DELETED"

    # Parse date
    date_string = txn["DateString"] || txn["Date"]
    transaction_date = parse_xero_date(date_string)
    return { error: "Invalid date for #{xero_id}" } unless transaction_date

    # Extract line item descriptions
    line_items = txn["LineItems"] || []

    # LIM (Jan 2026): XeroContact removed - ContactExternalLink is THE ONE SSoT
    xero_api_contact_id = txn.dig("Contact", "ContactID")

    # Build attributes
    attrs = {
      tenant_id: tenant_id,
      source: "xero",
      bank_account_id: txn.dig("BankAccount", "AccountID"),
      bank_account_code: txn.dig("BankAccount", "Code"),
      bank_account_name: txn.dig("BankAccount", "Name"),
      transaction_type: txn["Type"],
      transaction_date: transaction_date,
      reference: txn["Reference"],
      status: txn["Status"],
      is_reconciled: txn["IsReconciled"] || false,
      xero_contact_id: xero_api_contact_id,
      contact_name: txn.dig("Contact", "Name"),
      sub_total: txn["SubTotal"],
      total_tax: txn["TotalTax"],
      total: txn["Total"],
      currency_code: txn["CurrencyCode"] || "AUD",
      line_items: line_items,
      has_attachments: txn["HasAttachments"] || false,
      xero_updated_at: parse_xero_date(txn["UpdatedDateUTC"]),
      last_synced_at: Time.current
    }

    # Find or create
    record = XeroBankTransaction.find_by(xero_id: xero_id)

    if record
      record.update!(attrs)
      { updated: true }
    else
      XeroBankTransaction.create!(attrs.merge(xero_id: xero_id))
      { created: true }
    end

  rescue ActiveRecord::RecordInvalid => e
    { error: "Validation error for #{xero_id}: #{e.message}" }
  rescue StandardError => e
    { error: "Error processing #{xero_id}: #{e.message}" }
  end

  def parse_xero_date(date_input)
    return nil unless date_input.present?

    if date_input.is_a?(String)
      if date_input.start_with?("/Date(")
        # Parse Xero's /Date(timestamp)/ format
        timestamp = date_input.match(/\/Date\((\d+)/)&.captures&.first
        return Time.at(timestamp.to_i / 1000).to_date if timestamp
      else
        # Try parsing ISO format
        return Date.parse(date_input) rescue nil
      end
    end

    nil
  end

  # Update sync status for a specific tenant
  def update_sync_status(tenant_result, tenant_id)
    return unless tenant_id.present?

    records_synced = (tenant_result[:created] || 0) + (tenant_result[:updated] || 0)

    if tenant_result[:success]
      XeroSyncStatus.complete_sync!(
        "bank_transactions",
        tenant_id: tenant_id,
        records_synced: records_synced,
        next_sync_at: 6.hours.from_now
      )
    else
      XeroSyncStatus.fail_sync!(
        "bank_transactions",
        tenant_id: tenant_id,
        error: tenant_result[:error] || "Unknown error"
      )
    end
  end
end
