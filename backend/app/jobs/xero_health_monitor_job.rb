# frozen_string_literal: true

# XeroHealthMonitorJob - Self-healing health checks for Xero integration
#
# This job runs periodically (every hour) to:
# 1. Detect stale syncs (no activity in expected time window)
# 2. Check for excessive failed jobs in the queue
# 3. Monitor credentials at risk of 60-day inactivity expiry
# 4. Attempt auto-recovery for degraded credentials
# 5. Create/resolve alerts based on health status
#
# Run via solid_queue recurring schedule
class XeroHealthMonitorJob < ApplicationJob
  queue_as :xero_critical

  # Expected sync intervals (if no sync in this time, it's stale)
  EXPECTED_INTERVALS = {
    'invoices' => 1.hour,
    'contacts' => 1.hour,
    'bank_transactions' => 8.hours,
    'attachments' => 4.hours
  }.freeze

  # Maximum failed jobs before alerting
  MAX_FAILED_JOBS_THRESHOLD = 50

  def perform
    Rails.logger.info "[XeroHealthMonitor] Starting health check"

    event = XeroSyncEvent.start!(
      credential: nil,
      sync_type: 'health_check',
      trigger: 'scheduled'
    )

    begin
      issues_found = 0

      issues_found += check_stale_syncs
      issues_found += check_excessive_failures
      issues_found += check_inactive_credentials
      issues_found += check_disconnected_credentials
      issues_found += attempt_degraded_recovery

      # Log summary
      summary = XeroTokenManager.health_summary
      Rails.logger.info "[XeroHealthMonitor] Complete. Issues: #{issues_found}. " \
                       "Health: #{summary[:connected]} connected, #{summary[:degraded]} degraded, " \
                       "#{summary[:disconnected]} disconnected, #{summary[:circuit_open]} circuit open"

      event.complete!(
        records_processed: XeroCredential.count,
        metadata: { issues_found: issues_found, health_summary: summary }
      )
    rescue StandardError => e
      event.fail!(error: e.message, error_class: e.class.name)
      Rails.logger.error "[XeroHealthMonitor] Error: #{e.message}"
      raise
    end
  end

  private

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
        alert_type: 'sync_failed',
        severity: 'critical',
        dismissed: false,
        auto_resolved: false
      ) do |alert|
        alert.title = 'High number of failed Xero jobs'
        alert.message = "There are #{failed_count} failed Xero sync jobs in the queue. " \
                       "This may indicate a systemic problem with the Xero integration."
      end

      return 1
    end

    # Auto-resolve if back under threshold
    XeroAlert.where(alert_type: 'sync_failed', dismissed: false, auto_resolved: false)
             .update_all(auto_resolved: true, auto_resolved_at: Time.current)

    0
  rescue StandardError => e
    Rails.logger.error "[XeroHealthMonitor] Error checking failed jobs: #{e.message}"
    0
  end

  # Check for credentials at risk of 60-day inactivity expiry
  def check_inactive_credentials
    XeroTokenManager.check_inactive_credentials
    XeroCredential.healthy.where('last_successful_api_call_at < ?', XeroTokenManager::INACTIVITY_WARNING_DAYS.days.ago).count
  end

  # Log disconnected credentials (for awareness)
  def check_disconnected_credentials
    disconnected = XeroCredential.disconnected.count

    if disconnected > 0
      Rails.logger.warn "[XeroHealthMonitor] #{disconnected} disconnected Xero credentials need user re-authentication"
    end

    disconnected
  end

  # Attempt to recover degraded credentials
  def attempt_degraded_recovery
    recovered = 0

    XeroCredential.where(status: 'degraded').find_each do |credential|
      # If refresh_failure_count is low, try refreshing again
      next if credential.refresh_failure_count >= XeroTokenManager::MAX_REFRESH_ATTEMPTS

      Rails.logger.info "[XeroHealthMonitor] Attempting recovery for degraded credential: #{credential.tenant_name}"

      result = XeroTokenManager.refresh_credential(credential)

      if result[:success]
        Rails.logger.info "[XeroHealthMonitor] Recovered credential: #{credential.tenant_name}"
        recovered += 1
      end
    end

    recovered
  end

  # Create an alert for stale syncs
  def create_stale_sync_alert(credential, sync_type, last_synced_at)
    # Check if we already have an active alert for this
    existing = XeroAlert.where(
      xero_credential: credential,
      alert_type: 'sync_stale',
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
