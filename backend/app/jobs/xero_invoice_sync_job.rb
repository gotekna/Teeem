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
  include CacheConstants
  include DeduplicatableJob

  queue_as :xero_sync

  # Perform incremental sync of invoices from Xero
  # Can accept options:
  # - incremental: true (default) - only sync since last sync
  # - incremental: false - full sync
  # - tenant_id: specific tenant to sync (if omitted, syncs all tenants)
  # - xero_invoice_id: single invoice to sync (from webhook - avoids full tenant sync)
  # - action: "sync_from_xero" (webhook hint, currently informational)
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    # Webhook path: sync a single invoice instead of the entire tenant
    if options[:xero_invoice_id].present? && options[:tenant_id].present?
      sync_single_invoice(options)
    elsif options[:tenant_id].present?
      sync_tenant_with_rate_limiting(options)
    else
      sync_all_tenants_with_rate_limiting(options)
    end
  end

  private

  # Webhook path: fetch and process a single invoice (1 API call vs full sync)
  def sync_single_invoice(options)
    tenant_id = options[:tenant_id]
    invoice_id = options[:xero_invoice_id]

    # Pre-flight lockout check
    lockout = XeroRateLimitTracker.current_lockout(tenant_id: tenant_id)
    if lockout
      lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
      self.class.set(wait: (lockout_remaining + 60).seconds).perform_later(options)
      return { success: false, blocked_by_lockout: true }
    end

    service = ExternalInvoiceSyncService.new(source: "xero", tenant_id: tenant_id)
    invoice_data = service.send(:fetch_invoice_detail, invoice_id, tenant_id)

    if invoice_data
      service.send(:process_invoice, invoice_data, tenant_id)
      Rails.logger.info("XeroInvoiceSyncJob: Single invoice #{invoice_id} synced for tenant #{tenant_id}")
      { success: true, invoice_id: invoice_id }
    else
      Rails.logger.warn("XeroInvoiceSyncJob: Could not fetch invoice #{invoice_id} for tenant #{tenant_id}")
      { success: false, error: "Invoice not found" }
    end
  rescue XeroApiClient::RateLimitError => e
    handle_rate_limit_error(tenant_id, e, options)
    { success: false, rate_limited: true }
  rescue XeroApiClient::AuthenticationError => e
    credential = XeroCredential.find_by(tenant_id: tenant_id)
    credential&.mark_disconnected!
    { success: false, error: "Auth failed" }
  end

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
      rescue XeroApiClient::AuthenticationError => e
        # FRC (Feb 2026): Mark credential as disconnected so sync jobs stop queuing it.
        # Without this, a dead token causes failed API calls every sync cycle forever.
        Rails.logger.warn("XeroInvoiceSyncJob: Auth failed for #{credential.tenant_name}, marking disconnected")
        credential.mark_disconnected!
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: "Auth failed - marked disconnected" }
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
    # FRC (Feb 2026): next_sync_at MUST match recurring.yml schedule (every 15 min)
    records_synced = result[:stats][:created].to_i + result[:stats][:updated].to_i
    XeroSyncStatus.complete_sync!(
      "invoices",
      tenant_id: tenant_id,
      records_synced: records_synced,
      next_sync_at: 15.minutes.from_now
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
      expires_in: CACHE_TTL_DAILY
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
      expires_in: CACHE_TTL_DAILY
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

  # SSoT: extract_retry_after now in XeroJobBase concern
end
