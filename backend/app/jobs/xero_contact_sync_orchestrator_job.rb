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
  include DeduplicatableJob

  queue_as :xero_sync

  # Sessions older than this are considered stuck and will be auto-cancelled.
  # FRC (Feb 2026): Without this, a worker crash/OOM leaves XeroSyncSession
  # stuck in "fetching" forever. The orchestrator checks active_session? BEFORE
  # calling start! (which would cancel stale sessions), creating a deadlock
  # where the tenant is permanently locked out of sync.
  MAX_SESSION_AGE = 30.minutes

  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)
    run_orchestration(options)
  end

  private

  def run_orchestration(options)
    # FRC (Feb 2026): Break the deadlock - cancel stale sessions BEFORE
    # checking active_session? per tenant. Without this, crashed sessions
    # permanently block their tenant from syncing.
    cancel_stale_sessions

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

  def cancel_stale_sessions
    stale = XeroSyncSession.active.where("created_at < ?", MAX_SESSION_AGE.ago)
    count = stale.count
    return if count == 0

    stale.update_all(
      status: 'failed',
      error_message: "Auto-cancelled: exceeded #{MAX_SESSION_AGE.inspect} max session age",
      completed_at: Time.current
    )

    Rails.logger.warn("[XeroContactSyncOrchestrator] Auto-cancelled #{count} stale session(s) older than #{MAX_SESSION_AGE.inspect}")
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

  rescue XeroApiClient::AuthenticationError => e
    # FRC (Feb 2026): Mark credential disconnected so sync stops queuing it
    Rails.logger.warn("[XeroContactSyncOrchestrator] Auth failed for #{credential&.tenant_name}, marking disconnected")
    credential&.mark_disconnected!
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
