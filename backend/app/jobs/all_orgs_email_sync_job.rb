# AllOrgsEmailSyncJob - Dispatcher for syncing ALL connected MS365 organizations
#
# This job iterates all connected Microsoft credentials and enqueues
# OrgEmailSyncJob for each one. This ensures emails sync for ALL organizations,
# not just the first/fallback credential.
#
# Usage:
#   AllOrgsEmailSyncJob.perform_now           # Enqueue jobs for all orgs
#   AllOrgsEmailSyncJob.perform_later         # Queue in background
#
# Called by:
#   - Scheduled job in recurring.yml (every 15 minutes)
#   - Manual sync endpoint in synced_emails_controller.rb
#
class AllOrgsEmailSyncJob < ApplicationJob
  # FRC (Jan 2026): Moved from :low to :default queue
  # Email sync is user-visible and time-sensitive - shouldn't compete with background analytics
  queue_as :default

  def perform(sync_type = "incremental")
    # FRC (Feb 2026): Changed from .connected to .refreshable_app for 24/7 availability
    # Token may have expired overnight but can still be refreshed on-demand
    connected_credentials = MicrosoftCredential.refreshable_app

    if connected_credentials.empty?
      Rails.logger.info "[AllOrgsEmailSync] No connected MS365 organizations found"
      return { synced_orgs: 0 }
    end

    Rails.logger.info "[AllOrgsEmailSync] Starting #{sync_type} sync for #{connected_credentials.count} organization(s)"

    connected_credentials.each do |cred|
      Rails.logger.info "[AllOrgsEmailSync] Enqueuing sync for: #{cred.name || cred.id}"
      OrgEmailSyncJob.perform_later(sync_type, credential_id: cred.id)
    end

    { synced_orgs: connected_credentials.count }
  end
end
