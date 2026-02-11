# frozen_string_literal: true

# TenantBackupDispatcherJob - Schedule dispatcher for tenant backups
#
# This job runs periodically (e.g., every 15 minutes) and checks all
# tenant BackupConfigurations to see if any backups are due.
#
# For each tenant with a due backup, it queues the appropriate backup job:
#   - TenantDatabaseBackupJob for database backups
#   - TenantDocumentBackupJob for document backups
#
# This approach allows tenants to have different backup schedules without
# needing individual scheduled jobs for each tenant.
#
class TenantBackupDispatcherJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[BackupDispatcher] Starting backup schedule check"

    database_queued = 0
    document_queued = 0
    mirror_queued = 0

    # Check all enabled backup configurations
    BackupConfiguration.where(enabled: true).find_each do |config|
      ActsAsTenant.with_tenant(config.tenant) do
        # Check database backup (Tier 2: goes directly to B2)
        if config.backup_due?(:database)
          TenantDatabaseBackupJob.perform_later(config.tenant_id)
          database_queued += 1
          Rails.logger.info "[BackupDispatcher] Queued database backup for tenant #{config.tenant_id}"
        end

        # Check document backup (Tier 1: live → Wasabi backup bucket)
        if config.backup_due?(:documents)
          TenantDocumentBackupJob.perform_later(config.tenant_id)
          document_queued += 1
          Rails.logger.info "[BackupDispatcher] Queued document backup for tenant #{config.tenant_id}"
        end

        # Check mirror sync (Tier 2: live → B2, independent schedule)
        if config.backup_due?(:mirror)
          BackupMirrorJob.perform_later(config.tenant_id, "documents")
          mirror_queued += 1
          Rails.logger.info "[BackupDispatcher] Queued mirror sync for tenant #{config.tenant_id}"
        end
      end
    end

    Rails.logger.info "[BackupDispatcher] Complete - Queued #{database_queued} database, #{document_queued} document, #{mirror_queued} mirror backups"

    {
      database_backups_queued: database_queued,
      document_backups_queued: document_queued,
      mirror_syncs_queued: mirror_queued
    }
  end
end
