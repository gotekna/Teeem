# frozen_string_literal: true

# SyncEmailAttachmentsJob - Sync attachments for a single email from Microsoft Graph
#
# This job is designed to be run in parallel by multiple workers.
# The BatchSyncEmailAttachmentsJob enqueues many of these jobs at once.
#
# Usage:
#   SyncEmailAttachmentsJob.perform_later(email_id)
#
class SyncEmailAttachmentsJob < ApplicationJob
  queue_as :default

  # Retry on Graph API rate limiting
  retry_on Faraday::TooManyRequestsError, wait: :exponentially_longer, attempts: 5

  def perform(email_id)
    email = EmailWarehouse.find_by(id: email_id)

    unless email
      Rails.logger.warn "[SyncEmailAttachments] Email #{email_id} not found"
      return
    end

    unless email.has_attachments
      Rails.logger.debug "[SyncEmailAttachments] Email #{email_id} has no attachments"
      return
    end

    if email.email_attachments.any?
      Rails.logger.debug "[SyncEmailAttachments] Email #{email_id} already has attachments synced"
      return
    end

    begin
      email.sync_attachments!
      Rails.logger.info "[SyncEmailAttachments] Synced email #{email_id}: #{email.email_attachments.count} attachments"
    rescue StandardError => e
      Rails.logger.error "[SyncEmailAttachments] Failed to sync email #{email_id}: #{e.message}"
      raise # Re-raise for retry logic
    end
  end
end
