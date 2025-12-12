# SSoT Health Monitor for Xero Sync
# Checks if syncs are stale (> 5 min old) and triggers auto-recovery
#
# Schedule: Every 5 minutes
class XeroSyncHealthMonitorJob < ApplicationJob
  queue_as :default

  STALE_THRESHOLD = 5.minutes
  MAX_AUTO_RECOVERY_ATTEMPTS = 3

  def perform
    Rails.logger.info("[XeroSyncHealth] Starting health check...")

    results = {
      invoices: check_sync_health(:invoices),
      pdfs: check_sync_health(:pdfs),
      sharepoint: check_sync_health(:sharepoint),
      timestamp: Time.current
    }

    # Trigger auto-recovery if needed
    results.each do |sync_type, status|
      next if sync_type == :timestamp

      if status[:stale]
        attempt_auto_recovery(sync_type, status)
      end
    end

    # Log overall health
    stale_count = results.values.count { |v| v.is_a?(Hash) && v[:stale] }
    if stale_count > 0
      Rails.logger.warn("[XeroSyncHealth] ⚠️  #{stale_count} sync(s) are STALE!")
    else
      Rails.logger.info("[XeroSyncHealth] ✅ All syncs healthy")
    end

    results
  end

  private

  def check_sync_health(sync_type)
    status_record = XeroSyncStatus.find_by(sync_type: sync_type.to_s)

    unless status_record
      return {
        stale: true,
        reason: "No sync status record found",
        last_synced_at: nil,
        age_minutes: Float::INFINITY,
        recovery_needed: true
      }
    end

    last_synced = status_record.last_synced_at
    age = last_synced ? Time.current - last_synced : Float::INFINITY
    age_minutes = (age / 60.0).round(1)
    is_stale = age > STALE_THRESHOLD

    {
      stale: is_stale,
      last_synced_at: last_synced,
      age_minutes: age_minutes,
      threshold_minutes: (STALE_THRESHOLD / 60.0).round(0),
      recovery_needed: is_stale && age > (STALE_THRESHOLD * 2), # > 10 min = critical
      reason: is_stale ? "Last sync #{age_minutes} min ago (threshold: #{STALE_THRESHOLD / 60} min)" : nil
    }
  end

  def attempt_auto_recovery(sync_type, status)
    # Check recovery attempt count to prevent infinite loops
    cache_key = "xero_sync_recovery:#{sync_type}:attempts"
    attempts = Rails.cache.read(cache_key) || 0

    if attempts >= MAX_AUTO_RECOVERY_ATTEMPTS
      Rails.logger.error("[XeroSyncHealth] ❌ Max recovery attempts reached for #{sync_type}. Manual intervention needed.")
      # TODO: Send alert to Sentry or notification system
      return false
    end

    Rails.logger.warn("[XeroSyncHealth] 🔧 Attempting auto-recovery for #{sync_type} (attempt #{attempts + 1}/#{MAX_AUTO_RECOVERY_ATTEMPTS})")

    # Increment attempt counter (expires after 1 hour)
    Rails.cache.write(cache_key, attempts + 1, expires_in: 1.hour)

    # Trigger appropriate recovery action
    case sync_type
    when :invoices
      XeroInvoiceSyncJob.perform_later
      Rails.logger.info("[XeroSyncHealth] ✅ Queued XeroInvoiceSyncJob for recovery")
    when :pdfs
      XeroAttachmentSyncJob.perform_later(nil, limit: 100)
      Rails.logger.info("[XeroSyncHealth] ✅ Queued XeroAttachmentSyncJob for recovery")
    when :sharepoint
      # SharePoint uploads happen automatically with PDF sync
      XeroAttachmentSyncJob.perform_later(nil, limit: 50)
      Rails.logger.info("[XeroSyncHealth] ✅ Queued XeroAttachmentSyncJob (includes SharePoint) for recovery")
    end

    true
  end
end
