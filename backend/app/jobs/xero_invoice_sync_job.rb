# frozen_string_literal: true

# XeroInvoiceSyncJob - Syncs invoices from Xero to TEEEM
#
# Rate Limit Handling (Jan 2026):
# - Pre-flight lockout check before processing
# - Catches XeroApiClient::RateLimitError and records lockout
# - Schedules retry after lockout expires
# - Supports multi-org (syncs all tenants if none specified)
#
class XeroInvoiceSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :default

  # Perform incremental sync of invoices from Xero
  # Can accept options:
  # - incremental: true (default) - only sync since last sync
  # - incremental: false - full sync
  # - tenant_id: specific tenant to sync (if omitted, syncs all tenants)
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    if options[:tenant_id].present?
      sync_tenant_with_rate_limiting(options)
    else
      sync_all_tenants_with_rate_limiting(options)
    end
  end

  private

  # SSoT: Rate-limited sync for all tenants
  def sync_all_tenants_with_rate_limiting(options)
    Rails.logger.info("XeroInvoiceSyncJob: Syncing all tenants with rate limiting")

    credentials = XeroCredential.where(status: %w[connected degraded])

    if credentials.empty?
      Rails.logger.warn("XeroInvoiceSyncJob: No connected Xero credentials")
      return { success: false, error: "No connected credentials" }
    end

    combined_result = {
      success: true,
      tenants_processed: 0,
      total_created: 0,
      total_updated: 0,
      errors: []
    }

    credentials.find_each do |credential|
      # Check for lockout before each tenant
      lockout = XeroRateLimitTracker.current_lockout(tenant_id: credential.tenant_id)
      if lockout
        lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: credential.tenant_id)
        Rails.logger.warn("XeroInvoiceSyncJob: Tenant #{credential.tenant_name} locked out for #{lockout_remaining}s, scheduling retry")
        self.class.set(wait: (lockout_remaining + 60).seconds).perform_later(options.merge(tenant_id: credential.tenant_id))
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: "Rate limited, scheduled retry" }
        next
      end

      begin
        result = sync_tenant_internal(options.merge(tenant_id: credential.tenant_id))
        combined_result[:tenants_processed] += 1
        combined_result[:total_created] += result[:stats][:created].to_i rescue 0
        combined_result[:total_updated] += result[:stats][:updated].to_i rescue 0
      rescue XeroApiClient::RateLimitError => e
        handle_rate_limit_error(credential.tenant_id, e, options)
        combined_result[:success] = false
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: "Rate limited" }
        # FRC (Jan 2026): Changed break→next for multi-tenant SaaS scaling
        # Xero rate limits are per-connection, not global. If tenant A is rate-limited,
        # tenants B-Z should still sync. Critical for 10-15K connection scaling.
        next
      rescue StandardError => e
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: e.message }
      end
    end

    combined_result
  end

  # SSoT: Rate-limited sync for specific tenant
  def sync_tenant_with_rate_limiting(options)
    tenant_id = options[:tenant_id]

    # Pre-flight lockout check
    lockout = XeroRateLimitTracker.current_lockout(tenant_id: tenant_id)
    if lockout
      lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
      Rails.logger.warn("XeroInvoiceSyncJob: BLOCKED - Xero rate limit lockout for #{lockout_remaining}s")
      # Schedule retry after lockout expires
      self.class.set(wait: (lockout_remaining + 60).seconds).perform_later(options)
      return { success: false, blocked_by_lockout: true, retry_in_seconds: lockout_remaining + 60 }
    end

    begin
      sync_tenant_internal(options)
    rescue XeroApiClient::RateLimitError => e
      handle_rate_limit_error(tenant_id, e, options)
      { success: false, rate_limited: true }
    end
  end

  # Internal sync logic (without rate limit wrapper)
  def sync_tenant_internal(options)
    tenant_id = options[:tenant_id]
    incremental = options[:incremental] != false

    Rails.logger.info("XeroInvoiceSyncJob: Syncing tenant #{tenant_id} (incremental: #{incremental})")

    # Mark sync as in progress
    XeroSyncStatus.start_sync!("invoices", tenant_id: tenant_id)

    service = ExternalInvoiceSyncService.new(
      source: "xero",
      tenant_id: tenant_id
    )

    result = if incremental
               service.sync_incremental
    else
               service.sync
    end

    Rails.logger.info("XeroInvoiceSyncJob completed for tenant #{tenant_id}: #{result[:stats].inspect}")

    # Update SSoT with success
    # FRC (Feb 2026): next_sync_at MUST match recurring.yml schedule (every 5 min)
    # Previous 30-min value caused self-heal to not detect stale syncs in time
    records_synced = result[:stats][:created].to_i + result[:stats][:updated].to_i
    XeroSyncStatus.complete_sync!(
      "invoices",
      tenant_id: tenant_id,
      records_synced: records_synced,
      next_sync_at: 5.minutes.from_now
    )

    # Also keep cache for backwards compatibility
    Rails.cache.write(
      "xero_invoice_sync_last_result",
      {
        success: result[:success],
        synced_at: Time.current.iso8601,
        stats: result[:stats],
        incremental: incremental,
        tenant_id: tenant_id
      },
      expires_in: 24.hours
    )

    result
  rescue StandardError => e
    Rails.logger.error("XeroInvoiceSyncJob failed for tenant #{tenant_id}: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))

    # Update SSoT with failure
    XeroSyncStatus.fail_sync!("invoices", tenant_id: tenant_id, error: e.message)

    # Also keep cache for backwards compatibility
    Rails.cache.write(
      "xero_invoice_sync_last_result",
      {
        success: false,
        synced_at: Time.current.iso8601,
        error: e.message,
        incremental: options[:incremental] != false,
        tenant_id: tenant_id
      },
      expires_in: 24.hours
    )

    raise
  end

  # Handle rate limit errors by recording lockout and scheduling retry
  def handle_rate_limit_error(tenant_id, error, options)
    retry_after = extract_retry_after(error.message)
    XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id)

    Rails.logger.warn("XeroInvoiceSyncJob: RATE LIMITED - Scheduling retry in #{retry_after + 60}s")
    XeroSyncStatus.fail_sync!("invoices", tenant_id: tenant_id, error: "Rate limited by Xero - retry in #{retry_after}s")

    # Schedule retry after lockout expires
    self.class.set(wait: (retry_after + 60).seconds).perform_later(options.merge(tenant_id: tenant_id))
  end

  # Extract retry_after seconds from RateLimitError message
  def extract_retry_after(message)
    match = message.to_s.match(/retry after (\d+)/i)
    match ? match[1].to_i : 3600  # Default 1 hour if not parseable
  end
end
