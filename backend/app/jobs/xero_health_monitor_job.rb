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
  EXPECTED_INTERVALS = {
    "invoices" => 1.hour,
    "contacts" => 1.hour,
    "bank_transactions" => 8.hours,
    "pdfs" => 4.hours
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
  SELF_HEAL_GRACE_PERIOD = 15.minutes

  # Maximum time a sync can be "in_progress" before we consider it stuck
  MAX_IN_PROGRESS_DURATION = 30.minutes

  # Maximum age for a pending job before considering it orphaned
  MAX_PENDING_JOB_AGE = 2.hours

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

      # Log summary
      summary = XeroTokenManager.health_summary
      Rails.logger.info "[XeroHealthMonitor] Complete. Orphans cleaned: #{orphans_cleaned}, Self-healed: #{healed}, Issues: #{issues_found}. " \
                       "Health: #{summary[:connected]} connected, #{summary[:degraded]} degraded, " \
                       "#{summary[:disconnected]} disconnected, #{summary[:circuit_open]} circuit open"

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
    cleaned
  rescue StandardError => e
    Rails.logger.error "[XeroHealthMonitor] Error cleaning orphaned jobs: #{e.message}"
    0
  end

  # SELF-HEAL: Check for stalled syncs and trigger them automatically
  # This is the key self-healing mechanism that prevents sync outages
  def self_heal_stalled_syncs
    healed = 0
    threshold = Time.current - SELF_HEAL_GRACE_PERIOD
    stuck_threshold = Time.current - MAX_IN_PROGRESS_DURATION

    XeroSyncStatus.all.find_each do |status|
      job_class_name = SYNC_TYPE_TO_JOB[status.sync_type]
      next unless job_class_name # Skip unknown sync types

      should_heal = false
      reason = nil

      # Case 1: next_sync_at is overdue and status is not in_progress
      if status.next_sync_at.present? && status.next_sync_at < threshold && status.status != "in_progress"
        should_heal = true
        reason = "overdue by #{((Time.current - status.next_sync_at) / 60).round} minutes"
      end

      # Case 2: Stuck in "in_progress" for too long (job may have crashed)
      if status.status == "in_progress" && status.updated_at < stuck_threshold
        should_heal = true
        reason = "stuck in_progress for #{((Time.current - status.updated_at) / 60).round} minutes"
        # Reset status to allow new job to start
        status.update!(status: "failed", last_error: "Auto-reset: job appeared stuck")
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
