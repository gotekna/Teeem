# frozen_string_literal: true

# Monitors Pay@ mailbox for incoming invoices
# Scheduled to run every 15 minutes via Solid Queue
# SSoT: Mailbox address configured in TenantSetting.monitored_mailbox_pay
#
class BillInboxSyncJob < ApplicationJob
  queue_as :default

  def perform(since: nil)
    Rails.logger.info "[BillInboxSyncJob] Starting..."

    results = BillInboxSyncService.new(since: since).sync!

    Rails.logger.info "[BillInboxSyncJob] Complete: #{results[:created]} bills created, #{results[:skipped]} skipped"
  rescue StandardError => e
    Rails.logger.error "[BillInboxSyncJob] Failed: #{e.message}"
    raise
  end
end
