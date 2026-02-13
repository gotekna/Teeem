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

  # FRC (Jan 2026): Moved from :low to :default queue
  # Email sync is user-visible and time-sensitive - shouldn't compete with background analytics
  queue_as :default

  # Time budget: stop processing if we've been running longer than this
  # Ensures the job completes before the next scheduled run (15 min)
  MAX_RUNTIME = 12.minutes

  def perform(sync_type = "incremental")
    started_at = Time.current

    # FRC (Feb 2026): Changed from .connected to .refreshable_app for 24/7 availability
    # Token may have expired overnight but can still be refreshed on-demand
    # Order by last_sync_at so stale credentials get priority
    connected_credentials = MicrosoftCredential.refreshable_app.order(:last_sync_at)

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
