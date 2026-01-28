# frozen_string_literal: true

# XeroContactSyncJob - Syncs contacts from Xero to TEEEM
#
# Rate Limit Handling (Jan 2026):
# - Pre-flight lockout check before processing
# - Catches XeroApiClient::RateLimitError and records lockout
# - Schedules retry after lockout expires
#
class XeroContactSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :default

  # Perform can accept different actions:
  # - No args: Full sync all tenants
  # - tenant_id: Sync specific tenant
  # - contact_id + tenant_id + action: Sync specific contact
  # - xero_contact_id + tenant_id + action: Import from Xero
  #
  # All syncing uses XeroContactSyncService which manages contact_external_links (SSoT)
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    # Route to appropriate handler based on options
    if options[:action] == "sync_from_xero" && options[:contact_id]
      sync_contact_from_xero(options[:contact_id], options[:tenant_id])
    elsif options[:action] == "import_from_xero" && options[:xero_contact_id]
      import_contact_from_xero(options[:xero_contact_id], options[:tenant_id])
    elsif options[:tenant_id]
      sync_tenant_with_rate_limiting(options[:tenant_id], options)
    else
      sync_all_tenants_with_rate_limiting(options)
    end
  end

  private

  # SSoT: Rate-limited sync for all tenants
  def sync_all_tenants_with_rate_limiting(options)
    Rails.logger.info("XeroContactSyncJob: Syncing all tenants with rate limiting")

    # Get all connected credentials
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
      # Check for lockout before each tenant
      lockout = XeroRateLimitTracker.current_lockout(tenant_id: credential.tenant_id)
      if lockout
        lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: credential.tenant_id)
        Rails.logger.warn("XeroContactSyncJob: Tenant #{credential.tenant_name} locked out for #{lockout_remaining}s, scheduling retry")
        self.class.set(wait: (lockout_remaining + 60).seconds).perform_later(options.merge(tenant_id: credential.tenant_id))
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
        break # Stop processing other tenants when rate limited
      rescue StandardError => e
        combined_result[:errors] << { tenant_id: credential.tenant_id, error: e.message }
      end
    end

    combined_result
  end

  # SSoT: Rate-limited sync for specific tenant
  def sync_tenant_with_rate_limiting(tenant_id, options)
    # Pre-flight lockout check
    lockout = XeroRateLimitTracker.current_lockout(tenant_id: tenant_id)
    if lockout
      lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
      Rails.logger.warn("XeroContactSyncJob: BLOCKED - Xero rate limit lockout for #{lockout_remaining}s")
      # Schedule retry after lockout expires
      self.class.set(wait: (lockout_remaining + 60).seconds).perform_later(options.merge(tenant_id: tenant_id))
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
    Rails.logger.info("XeroContactSyncJob: Syncing tenant #{tenant_id}")

    # Mark sync as in progress
    XeroSyncStatus.start_sync!("contacts", tenant_id: tenant_id)

    service = XeroContactSyncService.new(tenant_id: tenant_id)
    result = service.sync

    # Update SSoT with success
    records_synced = result[:stats][:synced].to_i rescue 0
    XeroSyncStatus.complete_sync!(
      "contacts",
      tenant_id: tenant_id,
      records_synced: records_synced,
      next_sync_at: 30.minutes.from_now
    )

    result
  rescue StandardError => e
    Rails.logger.error("XeroContactSyncJob failed for tenant #{tenant_id}: #{e.message}")
    XeroSyncStatus.fail_sync!("contacts", tenant_id: tenant_id, error: e.message)
    raise
  end

  # Handle rate limit errors by recording lockout and scheduling retry
  def handle_rate_limit_error(tenant_id, error, options)
    retry_after = extract_retry_after(error.message)
    XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id)

    Rails.logger.warn("XeroContactSyncJob: RATE LIMITED - Scheduling retry in #{retry_after + 60}s")
    XeroSyncStatus.fail_sync!("contacts", tenant_id: tenant_id, error: "Rate limited by Xero - retry in #{retry_after}s")

    # Schedule retry after lockout expires
    self.class.set(wait: (retry_after + 60).seconds).perform_later(options.merge(tenant_id: tenant_id))
  end

  # Extract retry_after seconds from RateLimitError message
  def extract_retry_after(message)
    match = message.to_s.match(/retry after (\d+)/i)
    match ? match[1].to_i : 3600  # Default 1 hour if not parseable
  end

  def sync_contact_from_xero(contact_id, tenant_id)
    Rails.logger.info("XeroContactSyncJob: Syncing contact #{contact_id} from Xero tenant #{tenant_id}")
    contact = Contact.find(contact_id)
    link = contact.xero_links.find_by(tenant_id: tenant_id)

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
