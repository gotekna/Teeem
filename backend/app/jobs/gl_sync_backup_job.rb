# frozen_string_literal: true

# Scheduled backup job for GL data sync
# Catches any webhook failures by periodically syncing all connected Xero tenants
#
# Schedule: Every 6 hours (configured in recurring.yml)
#
class GlSyncBackupJob < ApplicationJob
  queue_as :default

  # Stale threshold - sync if last sync was more than 4 hours ago
  STALE_THRESHOLD = 4.hours

  def perform
    Rails.logger.info("[GlSyncBackupJob] Starting backup sync check")

    synced_count = 0
    skipped_count = 0

    # Find all connected Xero credentials
    XeroCredential.where(status: 'connected').find_each do |xero_cred|
      result = process_tenant(xero_cred)

      if result == :synced
        synced_count += 1
      else
        skipped_count += 1
      end
    end

    Rails.logger.info("[GlSyncBackupJob] Completed: synced=#{synced_count}, skipped=#{skipped_count}")

    { synced: synced_count, skipped: skipped_count }
  end

  private

  def process_tenant(xero_cred)
    tenant_id = xero_cred.tenant_id
    tenant_name = xero_cred.tenant_name

    # Find corporate company for this tenant
    connection = xero_cred.corporate_company_xero_connections.first
    corporate_company = connection&.corporate_company

    unless corporate_company
      Rails.logger.warn("[GlSyncBackupJob] No company linked for tenant #{tenant_name} (#{tenant_id})")
      return :skipped
    end

    # Check last sync time from GL sync logs
    last_sync = Gl::SyncLog
      .where(external_provider: 'xero', external_tenant_id: tenant_id)
      .where(status: 'completed')
      .order(completed_at: :desc)
      .pick(:completed_at)

    # If synced recently, skip
    if last_sync && last_sync > STALE_THRESHOLD.ago
      Rails.logger.debug("[GlSyncBackupJob] Tenant #{tenant_name} synced recently (#{last_sync}), skipping")
      return :skipped
    end

    # Queue incremental sync
    Rails.logger.info("[GlSyncBackupJob] Tenant #{tenant_name} stale (last: #{last_sync || 'never'}), queueing sync")

    GlSyncJob.perform_later(
      corporate_company.id,
      'xero',
      tenant_id,
      'incremental',
      { triggered_by: 'backup_job' }
    )

    :synced
  rescue StandardError => e
    Rails.logger.error("[GlSyncBackupJob] Error processing tenant #{xero_cred.tenant_id}: #{e.message}")
    :skipped
  end
end
