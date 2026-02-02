# frozen_string_literal: true

# XeroHealthMonitorJob - Self-healing health checks for Xero integration
#
# This job runs periodically (every 15 minutes) to:
# 1. CLEAN UP orphaned jobs that block self-healing
# 2. SELF-HEAL stalled syncs (trigger jobs when next_sync_at is overdue)
# 3. Detect stale syncs (no activity in expected time window)
# 4. Check for excessive failed jobs in the queue
# 5. Monitor credentials at risk of 60-day inactivity expiry
# 6. Attempt auto-recovery for degraded credentials
# 7. Create/resolve alerts based on health status
#
# Run via solid_queue recurring schedule
class XeroHealthMonitorJob < ApplicationJob
  queue_as :default

  # Expected sync intervals (if no sync in this time, it's stale)
  # SSoT: Must match XeroSyncStatus::SYNC_TYPES ("pdfs" not "attachments")
  # FRC (Feb 2026): These MUST match the actual recurring.yml schedules!
  EXPECTED_INTERVALS = {
    "invoices" => 10.minutes,        # recurring.yml: every 5 minutes
    "contacts" => 30.minutes,        # recurring.yml: every 15 minutes (backup)
    "bank_transactions" => 8.hours,  # recurring.yml: every 6 hours
    "pdfs" => 3.hours                # recurring.yml: every 2 hours
  }.freeze

  # Maximum failed jobs before alerting
  MAX_FAILED_JOBS_THRESHOLD = 50

  # Sync type to job class mapping for self-healing
  # SSoT: Keys must match XeroSyncStatus::SYNC_TYPES
  SYNC_TYPE_TO_JOB = {
    "invoices" => "XeroInvoiceSyncJob",
    "contacts" => "XeroContactSyncJob",
    "pdfs" => "XeroAttachmentSyncJob",
    "bank_transactions" => "XeroBankTransactionSyncJob"
  }.freeze

  # How long past next_sync_at before we trigger self-heal (grace period)
  # FRC (Feb 2026): Reduced from 15 to 5 minutes to match health monitor frequency
  SELF_HEAL_GRACE_PERIOD = 5.minutes

  # Maximum time a sync can be "in_progress" before we consider it stuck
  MAX_IN_PROGRESS_DURATION = 30.minutes

  # Maximum age for a pending job before considering it orphaned
  # FRC (Feb 2026): Reduced from 2 hours to 30 minutes for faster recovery
  # A job pending for 30+ minutes without execution is definitely orphaned
  MAX_PENDING_JOB_AGE = 30.minutes

  def perform
    Rails.logger.info "[XeroHealthMonitor] Starting health check"

    event = XeroSyncEvent.start!(
      credential: nil,
      sync_type: "health_check",
      trigger: "scheduled"
    )

    begin
      issues_found = 0
      healed = 0
      orphans_cleaned = 0

      # CLEAN UP ORPHANED JOBS FIRST - these block self-healing!
      orphans_cleaned = cleanup_orphaned_jobs

      # SELF-HEAL - trigger any overdue syncs
      healed = self_heal_stalled_syncs

      issues_found += check_stale_syncs
      issues_found += check_excessive_failures
      issues_found += check_inactive_credentials
      issues_found += check_disconnected_credentials
      issues_found += attempt_degraded_recovery

      # Log comprehensive health metrics
      log_health_metrics(orphans_cleaned: orphans_cleaned, healed: healed, issues_found: issues_found)

      event.complete!(records_processed: XeroCredential.count)
    rescue StandardError => e
      event.fail!(error: e.message, error_class: e.class.name)
      Rails.logger.error "[XeroHealthMonitor] Error: #{e.message}"
      raise
    end
  end

  private

  # CLEANUP: Remove orphaned jobs that block self-healing
  # An orphaned job exists in solid_queue_jobs but has no execution record
  # (not scheduled, not claimed, not ready). These jobs will NEVER run but
  # block self-heal from creating new jobs.
  def cleanup_orphaned_jobs
    cleaned = 0
    orphan_threshold = Time.current - MAX_PENDING_JOB_AGE

    # Check each Xero job class for orphans
    SYNC_TYPE_TO_JOB.values.uniq.each do |job_class_name|
      # Find old pending jobs for this class
      old_pending_jobs = SolidQueue::Job
        .where(finished_at: nil)
        .where(class_name: job_class_name)
        .where("created_at < ?", orphan_threshold)

      old_pending_jobs.find_each do |job|
        # Check if job has any execution record
        has_scheduled = SolidQueue::ScheduledExecution.exists?(job_id: job.id)
        has_claimed = SolidQueue::ClaimedExecution.exists?(job_id: job.id)
        has_ready = SolidQueue::ReadyExecution.exists?(job_id: job.id)

        if !has_scheduled && !has_claimed && !has_ready
          # This job is orphaned - delete it
          Rails.logger.warn "[XeroHealthMonitor] Deleting orphaned job: #{job_class_name} (ID: #{job.id}, created: #{job.created_at})"
          job.destroy
          cleaned += 1
        end
      end
    end

    Rails.logger.info "[XeroHealthMonitor] Cleaned up #{cleaned} orphaned jobs" if cleaned > 0

    # Also clear stale batch locks that block new PDF sync jobs
    clear_stale_batch_locks

    cleaned
  rescue StandardError => e
    Rails.logger.error "[XeroHealthMonitor] Error cleaning orphaned jobs: #{e.message}"
    0
  end

  # Clear batch lock if no XeroAttachmentSyncJob is actually running
  # This prevents stuck cache locks from blocking new sync jobs indefinitely
  def clear_stale_batch_locks
    batch_lock_key = "xero:attachment_sync:batch_lock"

    # Check if lock exists
    lock_data = Rails.cache.read(batch_lock_key)
    return unless lock_data

    # Check if any XeroAttachmentSyncJob is actually running (claimed)
    actual_running = SolidQueue::Job
      .where(finished_at: nil)
      .where(class_name: "XeroAttachmentSyncJob")
      .joins("INNER JOIN solid_queue_claimed_executions ON solid_queue_claimed_executions.job_id = solid_queue_jobs.id")
      .exists?

    unless actual_running
      Rails.cache.delete(batch_lock_key)
      Rails.logger.info "[XeroHealthMonitor] Cleared stale batch lock for XeroAttachmentSyncJob (no job actually running)"
    end
  rescue StandardError => e
    Rails.logger.error "[XeroHealthMonitor] Error clearing batch locks: #{e.message}"
  end

  # SELF-HEAL: Check for stalled syncs and trigger them automatically
  # This is the key self-healing mechanism that prevents sync outages
  #
  # FRC (Feb 2026): Fixed gap where self-heal trusted `next_sync_at` set by jobs,
  # but didn't detect when recurring jobs failed to run at all. Now uses
  # `last_synced_at` + expected interval as the PRIMARY trigger.
  def self_heal_stalled_syncs
    healed = 0
    threshold = Time.current - SELF_HEAL_GRACE_PERIOD
    stuck_threshold = Time.current - MAX_IN_PROGRESS_DURATION

    XeroSyncStatus.all.find_each do |status|
      job_class_name = SYNC_TYPE_TO_JOB[status.sync_type]
      next unless job_class_name # Skip unknown sync types

      should_heal = false
      reason = nil

      # SSoT: Use EXPECTED_INTERVALS to determine staleness thresholds
      expected_interval = EXPECTED_INTERVALS[status.sync_type] || 1.hour
      stale_threshold = expected_interval * 2  # Double the expected interval = definitely stale

      # Case 1 (PRIORITY): last_synced_at is stale regardless of next_sync_at
      # FRC (Feb 2026): This is the PRIMARY self-heal trigger. Don't trust next_sync_at
      # because jobs may set it incorrectly (e.g., 30 min when schedule is 5 min).
      if status.status != "in_progress"
        if status.last_synced_at.nil? || status.last_synced_at < (Time.current - stale_threshold)
          should_heal = true
          age_minutes = status.last_synced_at ? ((Time.current - status.last_synced_at) / 60).round : nil
          reason = "stale: last sync #{age_minutes ? "#{age_minutes}m ago" : 'never'} (threshold: #{(stale_threshold / 60).round}m)"
        end
      end

      # Case 2: Stuck in "in_progress" for too long (job may have crashed)
      if status.status == "in_progress" && status.updated_at < stuck_threshold
        should_heal = true
        reason = "stuck in_progress for #{((Time.current - status.updated_at) / 60).round} minutes"
        # Reset status to allow new job to start
        status.update!(status: "failed", last_error: "Auto-reset: job appeared stuck")
      end

      # Case 3: next_sync_at is overdue (backup check)
      if !should_heal && status.next_sync_at.present? && status.next_sync_at < threshold && status.status != "in_progress"
        should_heal = true
        reason = "next_sync_at overdue by #{((Time.current - status.next_sync_at) / 60).round} minutes"
      end

      next unless should_heal

      # Check if a job for this sync type is already queued/running
      pending_job = SolidQueue::Job.where(finished_at: nil)
                                   .where("class_name = ?", job_class_name)
                                   .exists?

      if pending_job
        Rails.logger.info "[XeroHealthMonitor] Self-heal skipped for #{status.sync_type}: job already queued"
        next
      end

      # Trigger the sync job
      begin
        job_class = job_class_name.constantize
        job_class.perform_later
        healed += 1
        Rails.logger.info "[XeroHealthMonitor] Self-healed #{status.sync_type}: triggered #{job_class_name} (#{reason})"
      rescue StandardError => e
        Rails.logger.error "[XeroHealthMonitor] Failed to self-heal #{status.sync_type}: #{e.message}"
      end
    end

    healed
  end

  # Check for syncs that haven't run in their expected time window
  def check_stale_syncs
    issues = 0

    XeroCredential.healthy.find_each do |credential|
      EXPECTED_INTERVALS.each do |sync_type, expected_interval|
        health = XeroSyncEvent.health_for_type(
          sync_type: sync_type,
          credential: credential,
          expected_interval: expected_interval
        )

        if health[:status] == :stale
          issues += 1
          Rails.logger.warn "[XeroHealthMonitor] Stale sync: #{sync_type} for #{credential.tenant_name} " \
                           "(last: #{health[:last_run]&.iso8601 || 'never'})"

          create_stale_sync_alert(credential, sync_type, health[:last_run])
        elsif health[:status] == :failed
          issues += 1
          Rails.logger.warn "[XeroHealthMonitor] Failed sync: #{sync_type} for #{credential.tenant_name} " \
                           "(error: #{health[:message]})"
        end
      end
    end

    issues
  end

  # Check for excessive failed jobs in the queue
  def check_excessive_failures
    # Count failed Xero jobs
    failed_count = SolidQueue::FailedExecution.joins(:job)
                                              .where("solid_queue_jobs.class_name LIKE 'Xero%'")
                                              .count

    if failed_count > MAX_FAILED_JOBS_THRESHOLD
      Rails.logger.error "[XeroHealthMonitor] #{failed_count} failed Xero jobs in queue (threshold: #{MAX_FAILED_JOBS_THRESHOLD})"

      # Create a system-level alert (no specific credential)
      XeroAlert.find_or_create_by!(
        alert_type: "sync_failed",
        severity: "critical",
        dismissed: false,
        auto_resolved: false
      ) do |alert|
        alert.title = "High number of failed Xero jobs"
        alert.message = "There are #{failed_count} failed Xero sync jobs in the queue. " \
                       "This may indicate a systemic problem with the Xero integration."
      end

      return 1
    end

    # Auto-resolve if back under threshold
    XeroAlert.where(alert_type: "sync_failed", dismissed: false, auto_resolved: false)
             .update_all(auto_resolved: true, auto_resolved_at: Time.current)

    0
  rescue StandardError => e
    Rails.logger.error "[XeroHealthMonitor] Error checking failed jobs: #{e.message}"
    0
  end

  # Check for credentials at risk of 60-day inactivity expiry
  def check_inactive_credentials
    XeroTokenManager.check_inactive_credentials
    XeroCredential.healthy.where("last_successful_api_call_at < ?", XeroTokenManager::INACTIVITY_WARNING_DAYS.days.ago).count
  end

  # Log disconnected credentials (for awareness)
  def check_disconnected_credentials
    disconnected = XeroCredential.disconnected.count

    if disconnected > 0
      Rails.logger.warn "[XeroHealthMonitor] #{disconnected} disconnected Xero credentials need user re-authentication"
    end

    disconnected
  end

  # Attempt to recover degraded OR expired credentials
  def attempt_degraded_recovery
    recovered = 0

    # Find credentials that need token refresh:
    # 1. status="degraded" (explicit degraded state)
    # 2. status="connected" but token expired (needs proactive refresh)
    credentials_to_refresh = XeroCredential.all.select do |cred|
      cred.status == "degraded" || (cred.status == "connected" && cred.expired?)
    end

    credentials_to_refresh.each do |credential|
      # If refresh_failure_count is high, skip (avoid hammering failed refreshes)
      next if credential.refresh_failure_count >= XeroTokenManager::MAX_REFRESH_ATTEMPTS

      reason = credential.expired? ? "token expired" : "degraded status"
      Rails.logger.info "[XeroHealthMonitor] Attempting token refresh for #{credential.tenant_name} (#{reason})"

      result = XeroTokenManager.refresh_credential(credential)

      if result[:success]
        Rails.logger.info "[XeroHealthMonitor] Refreshed token for: #{credential.tenant_name}"
        recovered += 1

        # Trigger sync restart to resume syncing after recovery
        XeroTokenManager.trigger_sync_restart(reason: "health_monitor_recovery")
      else
        Rails.logger.warn "[XeroHealthMonitor] Failed to refresh #{credential.tenant_name}: #{result[:error]}"
      end
    end

    recovered
  end

  # Log comprehensive health metrics for visibility
  # FRC (Feb 2026): Added detailed metrics to diagnose self-heal failures
  def log_health_metrics(orphans_cleaned:, healed:, issues_found:)
    # Token health
    token_summary = XeroTokenManager.health_summary

    # Sync status health
    sync_statuses = XeroSyncStatus.all.group_by(&:sync_type).transform_values do |statuses|
      latest = statuses.max_by { |s| s.last_synced_at || Time.at(0) }
      age_minutes = latest&.last_synced_at ? ((Time.current - latest.last_synced_at) / 60).round : nil
      {
        status: latest&.status,
        age_minutes: age_minutes,
        last_error: latest&.last_error&.truncate(100)
      }
    end

    # Queue health
    queue_stats = {
      pending_xero_jobs: SolidQueue::Job.where(finished_at: nil).where("class_name LIKE 'Xero%'").count,
      failed_xero_jobs: SolidQueue::FailedExecution.joins(:job).where("solid_queue_jobs.class_name LIKE 'Xero%'").count,
      total_pending: SolidQueue::Job.where(finished_at: nil).count
    }

    # Log structured metrics
    Rails.logger.info "[XeroHealthMonitor] === HEALTH METRICS ==="
    Rails.logger.info "[XeroHealthMonitor] Actions: orphans_cleaned=#{orphans_cleaned}, self_healed=#{healed}, issues=#{issues_found}"
    Rails.logger.info "[XeroHealthMonitor] Tokens: connected=#{token_summary[:connected]}, degraded=#{token_summary[:degraded]}, " \
                      "disconnected=#{token_summary[:disconnected]}, circuit_open=#{token_summary[:circuit_open]}"
    Rails.logger.info "[XeroHealthMonitor] Queue: pending_xero=#{queue_stats[:pending_xero_jobs]}, " \
                      "failed_xero=#{queue_stats[:failed_xero_jobs]}, total_pending=#{queue_stats[:total_pending]}"

    sync_statuses.each do |sync_type, stats|
      status_emoji = case stats[:status]
                     when "success" then "✅"
                     when "failed" then "❌"
                     when "in_progress" then "⏳"
                     else "❓"
                     end
      Rails.logger.info "[XeroHealthMonitor] Sync[#{sync_type}]: #{status_emoji} #{stats[:status] || 'none'}, " \
                        "age=#{stats[:age_minutes] || '∞'}min#{stats[:last_error] ? ", error=#{stats[:last_error]}" : ''}"
    end

    Rails.logger.info "[XeroHealthMonitor] === END METRICS ==="
  rescue StandardError => e
    Rails.logger.error "[XeroHealthMonitor] Error logging metrics: #{e.message}"
  end

  # Create an alert for stale syncs
  def create_stale_sync_alert(credential, sync_type, last_synced_at)
    # Check if we already have an active alert for this
    existing = XeroAlert.where(
      xero_credential: credential,
      alert_type: "sync_stale",
      dismissed: false,
      auto_resolved: false
    ).where("message LIKE ?", "%#{sync_type}%").exists?

    return if existing

    XeroAlert.create_sync_stale!(
      credential,
      sync_type: sync_type,
      last_synced_at: last_synced_at
    )
  end
end
