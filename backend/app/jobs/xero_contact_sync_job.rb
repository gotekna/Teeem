# frozen_string_literal: true

# XeroContactSyncJob - Entry point for Xero contact sync operations
#
# This job has been refactored as part of the Ultra-Scale Xero Sync Architecture (Feb 2026).
# For bulk tenant syncs, it delegates to XeroContactSyncOrchestratorJob which uses:
#   - Fan-out pattern: orchestrator -> batch fetchers -> batch processors
#   - O(1) contact matching (vs O(n²) previously)
#   - Bulk database operations (vs individual inserts/updates)
#   - Adaptive rate limiting (vs hardcoded 1.2s delays)
#
# Individual contact syncs (webhook-triggered) still use XeroContactSyncService
# for real-time responsiveness.
#
class XeroContactSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :default

  # Perform can accept different actions:
  # - No args: Full sync all tenants (delegates to orchestrator)
  # - tenant_id: Sync specific tenant (delegates to orchestrator)
  # - contact_id + tenant_id + action: Sync specific contact (uses service)
  # - xero_contact_id + tenant_id + action: Import from Xero (uses service)
  #
  # Bulk syncs: XeroContactSyncOrchestratorJob (new, Feb 2026)
  # Single contact: XeroContactSyncService (existing, for webhooks)
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    # Route to appropriate handler based on options
    if options[:action] == "sync_from_xero" && options[:contact_id]
      # Single contact sync (webhook-triggered) - use service for speed
      sync_contact_from_xero(options[:contact_id], options[:tenant_id])
    elsif options[:action] == "import_from_xero" && options[:xero_contact_id]
      # Import single contact from Xero - use service
      import_contact_from_xero(options[:xero_contact_id], options[:tenant_id])
    elsif options[:use_legacy_sync]
      # Escape hatch: force legacy sync if new architecture has issues
      # Remove this option after new architecture is validated
      legacy_sync(options)
    else
      # Bulk sync - delegate to orchestrator (new architecture)
      delegate_to_orchestrator(options)
    end
  end

  private

  # Delegate bulk syncs to the new orchestrator-based architecture
  # This provides: O(1) matching, bulk DB operations, adaptive rate limiting
  def delegate_to_orchestrator(options)
    if options[:tenant_id]
      # Specific tenant - still use orchestrator but pass the tenant filter
      Rails.logger.info("[XeroContactSyncJob] Delegating tenant #{options[:tenant_id]} to orchestrator")
      XeroContactSyncOrchestratorJob.perform_later(
        tenant_filter: options[:tenant_id],
        force_full: options[:force_full]
      )
    else
      # All tenants
      Rails.logger.info("[XeroContactSyncJob] Delegating all tenants to orchestrator")
      XeroContactSyncOrchestratorJob.perform_later(
        force_full: options[:force_full]
      )
    end
  end

  # ============================================
  # LEGACY SYNC (escape hatch)
  # ============================================
  # Remove after new architecture is validated

  def legacy_sync(options)
    if options[:tenant_id]
      sync_tenant_with_rate_limiting(options[:tenant_id], options)
    else
      sync_all_tenants_with_rate_limiting(options)
    end
  end

  # SSoT: Rate-limited sync for all tenants
  def sync_all_tenants_with_rate_limiting(options)
    Rails.logger.info("XeroContactSyncJob: Syncing all tenants with rate limiting (LEGACY MODE)")

    credentials = XeroCredential.where(status: %w[connected degraded])

    if credentials.empty?
      Rails.logger.warn("XeroContactSyncJob: No connected Xero credentials")
      return { success: false, error: "No connected credentials" }
    end

    combined_result = {
      success: true,
      tenants_processed: 0,
      total_synced: 0,
      errors: []
    }

    credentials.find_each do |credential|
      lockout = XeroRateLimitTracker.current_lockout(tenant_id: credential.tenant_id)
      if lockout
        lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: credential.tenant_id)
        Rails.logger.warn("XeroContactSyncJob: Tenant #{credential.tenant_name} locked out for #{lockout_remaining}s, scheduling retry")
        self.class.set(wait: (lockout_remaining + 60).seconds).perform_later(options.merge(tenant_id: credential.tenant_id, use_legacy_sync: true))
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: "Rate limited, scheduled retry" }
        next
      end

      begin
        result = sync_tenant_internal(credential.tenant_id)
        combined_result[:tenants_processed] += 1
        combined_result[:total_synced] += result[:stats][:synced].to_i rescue 0
      rescue XeroApiClient::RateLimitError => e
        handle_rate_limit_error(credential.tenant_id, e, options)
        combined_result[:success] = false
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: "Rate limited" }
        next
      rescue StandardError => e
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: e.message }
      end
    end

    combined_result
  end

  # SSoT: Rate-limited sync for specific tenant
  def sync_tenant_with_rate_limiting(tenant_id, options)
    lockout = XeroRateLimitTracker.current_lockout(tenant_id: tenant_id)
    if lockout
      lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
      Rails.logger.warn("XeroContactSyncJob: BLOCKED - Xero rate limit lockout for #{lockout_remaining}s")
      self.class.set(wait: (lockout_remaining + 60).seconds).perform_later(options.merge(tenant_id: tenant_id, use_legacy_sync: true))
      return { success: false, blocked_by_lockout: true, retry_in_seconds: lockout_remaining + 60 }
    end

    begin
      sync_tenant_internal(tenant_id)
    rescue XeroApiClient::RateLimitError => e
      handle_rate_limit_error(tenant_id, e, options)
      { success: false, rate_limited: true }
    end
  end

  # Internal sync logic (without rate limit wrapper)
  def sync_tenant_internal(tenant_id)
    Rails.logger.info("XeroContactSyncJob: Syncing tenant #{tenant_id} (LEGACY MODE)")

    XeroSyncStatus.start_sync!("contacts", tenant_id: tenant_id)

    service = XeroContactSyncService.new(tenant_id: tenant_id)
    result = service.sync

    records_synced = result[:stats][:synced].to_i rescue 0
    XeroSyncStatus.complete_sync!(
      "contacts",
      tenant_id: tenant_id,
      records_synced: records_synced,
      next_sync_at: 15.minutes.from_now
    )

    result
  rescue StandardError => e
    Rails.logger.error("XeroContactSyncJob failed for tenant #{tenant_id}: #{e.message}")
    XeroSyncStatus.fail_sync!("contacts", tenant_id: tenant_id, error: e.message)
    raise
  end

  def handle_rate_limit_error(tenant_id, error, options)
    retry_after = extract_retry_after(error.message)
    XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id)

    Rails.logger.warn("XeroContactSyncJob: RATE LIMITED - Scheduling retry in #{retry_after + 60}s")
    XeroSyncStatus.fail_sync!("contacts", tenant_id: tenant_id, error: "Rate limited by Xero - retry in #{retry_after}s")

    self.class.set(wait: (retry_after + 60).seconds).perform_later(options.merge(tenant_id: tenant_id, use_legacy_sync: true))
  end

  def extract_retry_after(message)
    match = message.to_s.match(/retry after (\d+)/i)
    match ? match[1].to_i : 3600
  end

  # ============================================
  # SINGLE CONTACT SYNC (for webhooks)
  # ============================================
  # These still use XeroContactSyncService for real-time responsiveness

  def sync_contact_from_xero(contact_id, tenant_id)
    Rails.logger.info("XeroContactSyncJob: Syncing contact #{contact_id} from Xero tenant #{tenant_id}")
    contact = Contact.find(contact_id)
    # FRC (Feb 2026): Renamed tenant_id to xero_org_id for consistency
    link = contact.xero_links.find_by(xero_org_id: tenant_id)

    if link
      service = XeroContactSyncService.new(tenant_id: tenant_id)
      service.sync_from_xero(link)
    else
      Rails.logger.warn("No xero_link found for contact #{contact_id} and tenant #{tenant_id}")
    end
  end

  def import_contact_from_xero(xero_contact_id, tenant_id)
    Rails.logger.info("XeroContactSyncJob: Importing Xero contact #{xero_contact_id} from tenant #{tenant_id}")
    service = XeroContactSyncService.new(tenant_id: tenant_id)
    xero_contact = service.fetch_single_xero_contact(xero_contact_id, tenant_id)

    if xero_contact
      service.create_teeem_contact_from_xero(xero_contact, tenant_id)
    else
      Rails.logger.warn("Could not fetch Xero contact #{xero_contact_id} from tenant #{tenant_id}")
    end
  end
end
