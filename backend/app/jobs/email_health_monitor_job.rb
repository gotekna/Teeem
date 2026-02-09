# frozen_string_literal: true

# EmailHealthMonitorJob - Self-healing health checks for email sync
#
# This job runs periodically (every 5 minutes) to:
# 1. CLEAN UP orphaned jobs that block self-healing
# 2. SELF-HEAL stalled syncs (trigger jobs when sync is overdue)
# 3. Detect stale syncs (no activity in expected time window)
# 4. Check for excessive failed syncs
# 5. Monitor accounts with sync errors
# 6. Attempt auto-recovery for failed accounts
#
# Run via solid_queue recurring schedule
class EmailHealthMonitorJob < ApplicationJob
  queue_as :default

  # Expected sync intervals (if no sync in this time, it's stale)
  EXPECTED_INTERVALS = {
    "ms365" => 20.minutes,  # Office 365 syncs every 15 min, grace period 5 min
    "imap" => 5.minutes     # IMAP syncs every 2 min, grace period 3 min
  }.freeze

  # How long past expected interval before we trigger self-heal
  SELF_HEAL_GRACE_PERIOD = 10.minutes

  # Maximum time a sync can be stuck before we consider it failed
  MAX_SYNC_DURATION = 30.minutes

  # Maximum age for a pending job before considering it orphaned
  MAX_PENDING_JOB_AGE = 2.hours

  def perform
    Rails.logger.info "[EmailHealthMonitor] Starting health check"

    begin
      issues_found = 0
      healed = 0
      orphans_cleaned = 0

      # FIX CONTRADICTIONS - detect credentials with status=connected but refresh_token_dead=true
      # FRC (Feb 2026): This contradiction silently broke email sync for 5 days.
      # Root cause: fetch_app_token! set status="connected" without clearing refresh_token_dead.
      contradictions_fixed = fix_status_contradictions

      # CLEAN UP ORPHANED JOBS FIRST - these block self-healing!
      orphans_cleaned = cleanup_orphaned_jobs

      # SELF-HEAL - trigger any overdue syncs
      healed = self_heal_stalled_syncs

      # CHECK for issues
      issues_found += check_stale_syncs
      issues_found += check_failed_accounts
      issues_found += attempt_auto_recovery

      # Log summary
      Rails.logger.info "[EmailHealthMonitor] Complete. Contradictions fixed: #{contradictions_fixed}, " \
                        "Orphans cleaned: #{orphans_cleaned}, Self-healed: #{healed}, Issues: #{issues_found}"

      {
        contradictions_fixed: contradictions_fixed,
        orphans_cleaned: orphans_cleaned,
        healed: healed,
        issues_found: issues_found,
        status: :success
      }
    rescue StandardError => e
      Rails.logger.error "[EmailHealthMonitor] Error: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      Sentry.capture_exception(e) if defined?(Sentry)
      raise
    end
  end

  private

  # FRC (Feb 2026): Detect and fix status contradictions
  # Root cause: fetch_app_token! was setting status="connected" without clearing refresh_token_dead.
  # This caused MicrosoftAppGraphClient to raise DeadTokenError while UI showed "Connected".
  # For app credentials, refresh_token_dead is meaningless (they use client_credentials grant),
  # so we can safely reset it. For delegated credentials, mark as dead so UI shows the error.
  def fix_status_contradictions
    fixed = 0

    MicrosoftCredential.active.where(refresh_token_dead: true).where.not(status: "dead").find_each do |credential|
      if credential.app_credential?
        # App credentials don't use refresh tokens - refresh_token_dead is a false alarm
        # Try to fetch a fresh token to verify the credential actually works
        if credential.fetch_app_token!
          Rails.logger.info "[EmailHealthMonitor] Fixed contradiction for app credential #{credential.name}: " \
                            "cleared refresh_token_dead (status was #{credential.status})"
          fixed += 1
        else
          # Token fetch failed - mark as dead properly
          credential.mark_dead!("Health monitor: app token fetch failed")
          Rails.logger.warn "[EmailHealthMonitor] App credential #{credential.name} truly dead - marked status as dead"
          fixed += 1
        end
      else
        # Delegated credentials with refresh_token_dead=true should have status=dead
        credential.mark_dead!("Health monitor: refresh_token_dead but status was #{credential.status}")
        Rails.logger.warn "[EmailHealthMonitor] Fixed contradiction for delegated credential #{credential.name}: " \
                          "marked as dead (was #{credential.status})"
        fixed += 1
      end
    end

    fixed
  end

  # Clean up orphaned email sync jobs that are stuck in pending
  def cleanup_orphaned_jobs
    cleaned = 0

    # Find stuck IMAP sync jobs
    stuck_imap_jobs = SolidQueue::Job
      .where(queue_name: "default")
      .where("class_name LIKE ?", "%ImapSyncJob%")
      .where("created_at < ?", MAX_PENDING_JOB_AGE.ago)
      .where(finished_at: nil)

    stuck_imap_jobs.each do |job|
      Rails.logger.warn "[EmailHealthMonitor] Deleting orphaned IMAP sync job: #{job.id} (age: #{Time.current - job.created_at}s)"
      job.destroy
      cleaned += 1
    end

    # Find stuck Office 365 sync jobs
    stuck_org_jobs = SolidQueue::Job
      .where(queue_name: "default")
      .where("class_name LIKE ?", "%OrgEmailSyncJob%")
      .where("created_at < ?", MAX_PENDING_JOB_AGE.ago)
      .where(finished_at: nil)

    stuck_org_jobs.each do |job|
      Rails.logger.warn "[EmailHealthMonitor] Deleting orphaned Office 365 sync job: #{job.id} (age: #{Time.current - job.created_at}s)"
      job.destroy
      cleaned += 1
    end

    cleaned
  end

  # Trigger recovery syncs for stalled accounts
  def self_heal_stalled_syncs
    healed = 0

    # Check IMAP accounts
    ImapCredential.where(is_active: true).find_each do |credential|
      next unless stalled?(credential, "imap")

      Rails.logger.warn "[EmailHealthMonitor] Triggering recovery sync for IMAP account: #{credential.email_address}"
      ImapSyncJob.perform_later(credential.id, full_sync: false)
      healed += 1
    end

    # Check Office 365 accounts
    MicrosoftCredential.refreshable_app.find_each do |credential|
      next unless stalled?(credential, "ms365")

      Rails.logger.warn "[EmailHealthMonitor] Triggering recovery sync for Office 365 org: #{credential.name}"
      OrgEmailSyncJob.perform_later("incremental", credential_id: credential.id)
      healed += 1
    end

    healed
  end

  # Check if account sync is stalled (overdue)
  def stalled?(credential, account_type)
    # SSoT: IMAP uses last_synced_at, MS365 uses last_sync_at
    last_sync = account_type == "imap" ? credential.last_synced_at : credential.last_sync_at
    return false unless last_sync

    expected_interval = EXPECTED_INTERVALS[account_type]
    grace_period = SELF_HEAL_GRACE_PERIOD

    # Stalled if: last_sync + expected_interval + grace_period < now
    last_sync + expected_interval + grace_period < Time.current
  end

  # Check for stale syncs and log warnings
  def check_stale_syncs
    stale_count = 0

    # Check IMAP accounts
    ImapCredential.where(is_active: true).find_each do |credential|
      if stale?(credential, "imap")
        Rails.logger.warn "[EmailHealthMonitor] Stale IMAP sync: #{credential.email_address} " \
                          "(last sync: #{credential.last_synced_at || 'never'})"
        stale_count += 1
      end
    end

    # Check Office 365 accounts
    MicrosoftCredential.refreshable_app.find_each do |credential|
      if stale?(credential, "ms365")
        Rails.logger.warn "[EmailHealthMonitor] Stale Office 365 sync: #{credential.name} " \
                          "(last sync: #{credential.last_sync_at})"
        stale_count += 1
      end
    end

    stale_count
  end

  # Check if account is stale (no sync in expected interval)
  def stale?(credential, account_type)
    last_sync = account_type == "imap" ? credential.last_synced_at : credential.last_sync_at
    return false unless last_sync

    expected_interval = EXPECTED_INTERVALS[account_type]
    last_sync + expected_interval < Time.current
  end

  # Check for accounts with sync errors
  def check_failed_accounts
    failed_count = 0

    # Check IMAP accounts with errors
    ImapCredential.where(is_active: true).where.not(last_sync_error: [nil, ""]).find_each do |credential|
      Rails.logger.error "[EmailHealthMonitor] IMAP account has sync error: #{credential.email_address} - #{credential.last_sync_error}"
      failed_count += 1

      # Alert to Sentry if error persists for > 1 hour
      if credential.updated_at < 1.hour.ago
        Sentry.capture_message(
          "Email sync failure: #{credential.email_address}",
          level: :error,
          extra: { error: credential.last_sync_error, account_id: credential.id }
        ) if defined?(Sentry)
      end
    end

    failed_count
  end

  # Attempt auto-recovery for failed accounts
  def attempt_auto_recovery
    recovered = 0

    # Try to recover IMAP accounts with connection errors
    ImapCredential.where(is_active: true)
                  .where("last_sync_error LIKE ?", "%connection%")
                  .where("updated_at < ?", 30.minutes.ago)
                  .find_each do |credential|

      Rails.logger.info "[EmailHealthMonitor] Attempting auto-recovery for IMAP: #{credential.email_address}"

      # Test connection
      test_result = credential.test_connection
      if test_result[:success]
        Rails.logger.info "[EmailHealthMonitor] Connection recovered for IMAP: #{credential.email_address}"
        credential.update!(last_sync_error: nil, last_sync_status: "success")
        ImapSyncJob.perform_later(credential.id, full_sync: false)
        recovered += 1
      else
        Rails.logger.warn "[EmailHealthMonitor] Recovery failed for IMAP: #{credential.email_address} - #{test_result[:error]}"
      end
    end

    recovered
  end
end
