# AllOrgsEmailSyncJob - Dispatcher for syncing ALL connected MS365 organizations
#
# FRC (Feb 2026): Changed from fan-out (enqueue child jobs) to inline iteration.
# At scale (10,000 tenants), fan-out creates 10,000+ child jobs per cycle,
# overwhelming the queue. Inline iteration processes sequentially with a time
# budget so a single long-running sync doesn't block others.
#
# Usage:
#   AllOrgsEmailSyncJob.perform_now           # Sync all orgs inline
#   AllOrgsEmailSyncJob.perform_later         # Queue in background
#
# Called by:
#   - Scheduled job in recurring.yml (every 15 minutes)
#   - Manual sync endpoint in synced_emails_controller.rb
#
class AllOrgsEmailSyncJob < ApplicationJob
  include DeduplicatableJob

  # FRC (Feb 2026): Moved from :default to :email_sync queue
  # Long-running job (12 min budget) that was starving health monitors on :default.
  # On :email_sync (lower priority than default), health monitors always run first.
  queue_as :email_sync

  # Time budget: stop processing if we've been running longer than this
  # FRC (Feb 2026): Reduced from 14min to 5min. Email worker has 1 thread shared
  # between sync (email_sync queue) and uploads (email_enrichment queue).
  # At 14min/15min = 93% utilization, upload jobs were starved (never ran).
  # At 5min/15min = 33%, leaves ~10min for UploadEmailsToStorageJob,
  # UploadEmailsToStorageJob (IMAP phase), and other email_enrichment work.
  # Unfinished orgs get picked up on the next 15-min cycle.
  MAX_RUNTIME = 5.minutes

  def perform(sync_type = "incremental")
    started_at = Time.current

    # FRC (Feb 2026): Changed from .connected to .refreshable_app for 24/7 availability
    # Token may have expired overnight but can still be refreshed on-demand
    # ⚠️ FRC (Feb 2026): NULLS FIRST - new credentials that have never synced get priority
    # Root cause: PostgreSQL sorts NULLs last with ORDER BY ASC, so new credentials
    # (last_sync_at = NULL) were always processed last, starved by the 12-minute time budget,
    # and could never complete their first sync (Pilgrim Homes synced 2/56 mailboxes in 2 weeks).
    connected_credentials = MicrosoftCredential.refreshable_app.order(Arel.sql("last_sync_at ASC NULLS FIRST"))

    if connected_credentials.empty?
      Rails.logger.info "[AllOrgsEmailSync] No connected MS365 organizations found"
      return { synced_orgs: 0, skipped: 0 }
    end

    Rails.logger.info "[AllOrgsEmailSync] Starting #{sync_type} inline sync for #{connected_credentials.count} organization(s)"

    synced = 0
    skipped = 0

    connected_credentials.each do |cred|
      # Time budget check - stop if we're running too long
      if Time.current - started_at > MAX_RUNTIME
        remaining = connected_credentials.count - synced - skipped
        Rails.logger.warn "[AllOrgsEmailSync] Time budget exceeded after #{synced} syncs, #{remaining} remaining - will catch up next run"
        break
      end

      begin
        Rails.logger.info "[AllOrgsEmailSync] Syncing inline: #{cred.name || cred.id}"
        OrgEmailSyncJob.new.perform(sync_type, credential_id: cred.id)
        synced += 1
      rescue StandardError => e
        skipped += 1
        Rails.logger.error "[AllOrgsEmailSync] Failed for #{cred.name || cred.id}: #{e.class} - #{e.message}"
      end
    end

    Rails.logger.info "[AllOrgsEmailSync] Complete: synced=#{synced}, skipped=#{skipped}"
    { synced_orgs: synced, skipped: skipped }
  end
end
