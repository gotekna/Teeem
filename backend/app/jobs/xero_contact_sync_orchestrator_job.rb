# frozen_string_literal: true

# XeroContactSyncOrchestratorJob: Fan-out coordinator for ultra-scale sync
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
#
# This job coordinates sync across multiple Xero organizations (tenants).
# It does NOT process contacts itself - it creates XeroSyncSessions and
# dispatches batch fetch jobs.
#
# Flow:
#   Orchestrator -> XeroContactBatchFetchJob (per tenant)
#              -> XeroContactBatchProcessJob (per batch)
#
# Schedule: Every 15 minutes via recurring.yml
# Queue: default (was xero_orchestrator, but SolidQueue uses default)
#
class XeroContactSyncOrchestratorJob < ApplicationJob
  queue_as :default

  # Lock key for preventing duplicate orchestrator runs
  LOCK_KEY = "xero_contact_sync_orchestrator:running"
  LOCK_TIMEOUT = 30.minutes  # Max time an orchestrator can run

  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    # Prevent duplicate orchestrator runs using cache lock
    unless acquire_lock
      Rails.logger.info("[XeroContactSyncOrchestrator] Another orchestrator is already running, skipping")
      return
    end

    begin
      run_orchestration(options)
    ensure
      release_lock
    end
  end

  private

  def acquire_lock
    # Try to set the lock - returns true if we got it, false if already set
    Rails.cache.write(LOCK_KEY, Time.current.to_s, unless_exist: true, expires_in: LOCK_TIMEOUT)
  end

  def release_lock
    Rails.cache.delete(LOCK_KEY)
  end

  def run_orchestration(options)
    # Self-heal any stale lockouts before starting
    XeroRateLimitTracker.heal_all_lockouts!

    # Get connected/degraded Xero credentials
    # Optionally filter to specific tenant if requested
    credentials = XeroCredential.where(status: %w[connected degraded])

    if options[:tenant_filter].present?
      credentials = credentials.where(tenant_id: options[:tenant_filter])
    end

    if credentials.empty?
      Rails.logger.info("[XeroContactSyncOrchestrator] No connected Xero credentials found")
      return
    end

    Rails.logger.info("[XeroContactSyncOrchestrator] Starting sync for #{credentials.count} tenants")

    credentials.find_each do |credential|
      process_tenant(credential, options)
    end

    Rails.logger.info("[XeroContactSyncOrchestrator] Dispatched sync jobs for all tenants")
  end

  def process_tenant(credential, options)
    tenant_id = credential.tenant_id
    teeem_tenant_id = credential.teeem_tenant_id

    # Skip if currently rate limited
    if rate_limited?(tenant_id)
      Rails.logger.info("[XeroContactSyncOrchestrator] Skipping tenant #{credential.tenant_name} (#{tenant_id}): rate limited")
      return
    end

    # Skip if there's an active session (prevent duplicate syncs)
    if active_session?(tenant_id)
      Rails.logger.info("[XeroContactSyncOrchestrator] Skipping tenant #{credential.tenant_name} (#{tenant_id}): sync in progress")
      return
    end

    # Determine sync type (full vs incremental)
    sync_config = determine_sync_type(tenant_id, options)

    # Create session for progress tracking
    session = XeroSyncSession.start!(
      tenant_id,
      teeem_tenant_id: teeem_tenant_id,
      sync_type: 'contacts',
      sync_mode: sync_config[:mode],
      modified_since: sync_config[:modified_since]
    )

    Rails.logger.info("[XeroContactSyncOrchestrator] Created session #{session.id} for #{credential.tenant_name}: #{sync_config[:mode]} sync")

    # Dispatch batch fetch job
    XeroContactBatchFetchJob.perform_later(
      session_id: session.id,
      page: 1,
      tenant_name: credential.tenant_name
    )

  rescue StandardError => e
    Rails.logger.error("[XeroContactSyncOrchestrator] Error processing tenant #{tenant_id}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    # Continue with other tenants - don't let one failure block all
  end

  def determine_sync_type(tenant_id, options)
    # Force full sync if requested
    return { mode: 'full', modified_since: nil } if options[:force_full]

    # Check last successful sync
    last_sync = XeroSyncSession.last_successful_for(tenant_id, sync_type: 'contacts')

    # Do incremental if last sync was within 24 hours
    if last_sync&.completed_at && last_sync.completed_at > 24.hours.ago
      {
        mode: 'incremental',
        modified_since: last_sync.completed_at - 5.minutes  # 5 min overlap for safety
      }
    else
      { mode: 'full', modified_since: nil }
    end
  end

  def rate_limited?(tenant_id)
    XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?
  end

  def active_session?(tenant_id)
    XeroSyncSession.active.for_tenant(tenant_id).contacts.exists?
  end
end
