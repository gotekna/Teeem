# frozen_string_literal: true

# Monitors Pay@ mailbox for incoming invoices
# Scheduled to run every 15 minutes via Solid Queue
# SSoT: Mailbox address configured in TenantSetting.monitored_mailbox_pay
#
class BillInboxSyncJob < ApplicationJob
  include DeduplicatableJob
  include StaleJobGuard

  self.max_job_age = 20.minutes # Schedule: every 15min

  queue_as :default

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: BillInboxSyncService reads TenantSetting.monitored_mailbox_pay
  # which returns nil without tenant context. Job silently did nothing.
  def perform(since: nil)
    Rails.logger.info "[BillInboxSyncJob] Starting..."

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        sync_for_tenant(since)
      end
    end
  rescue StandardError => e
    Rails.logger.error "[BillInboxSyncJob] Failed: #{e.message}"
    raise
  end

  private

  def sync_for_tenant(since)
    results = BillInboxSyncService.new(since: since).sync!

    if results[:created] > 0 || results[:skipped] > 0
      Rails.logger.info "[BillInboxSyncJob] #{ActsAsTenant.current_tenant.name}: #{results[:created]} bills created, #{results[:skipped]} skipped"
    end
  rescue StandardError => e
    Rails.logger.error "[BillInboxSyncJob] Error for #{ActsAsTenant.current_tenant.name}: #{e.message}"
  end
end
