# frozen_string_literal: true

# BatchSyncEmailAttachmentsJob - Enqueue many SyncEmailAttachmentsJob jobs for parallel processing
#
# This job finds emails that have attachments but haven't been synced yet,
# and enqueues individual SyncEmailAttachmentsJob jobs for each one.
# This allows Solid Queue workers to process them in parallel.
#
# Usage:
#   BatchSyncEmailAttachmentsJob.perform_later(limit: 500)
#
# Or from console/rake:
#   BatchSyncEmailAttachmentsJob.perform_now(limit: 1000)
#
class BatchSyncEmailAttachmentsJob < ApplicationJob
  queue_as :low

  def perform(limit: 500)
    # Find emails that:
    # - have attachments
    # - have required Microsoft Graph info (outlook_id, mailbox, credential)
    # - don't have any email_attachments yet
    emails_to_sync = SyncedEmail
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .order(received_at: :desc)
      .limit(limit)
      .pluck(:id)

    total = emails_to_sync.count
    Rails.logger.info "[BatchSyncEmailAttachments] Enqueuing #{total} emails for attachment sync"

    # Enqueue individual jobs - Solid Queue will process in parallel
    emails_to_sync.each do |email_id|
      SyncEmailAttachmentsJob.perform_later(email_id)
    end

    # Log remaining count
    remaining = SyncedEmail
      .where(has_attachments: true)
      .where.not(outlook_id: nil, mailbox_owner_email: nil, microsoft_credential_id: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .count

    Rails.logger.info "[BatchSyncEmailAttachments] Enqueued #{total} jobs. Remaining after this batch: #{remaining - total}"

    { enqueued: total, remaining: remaining - total }
  end
end
