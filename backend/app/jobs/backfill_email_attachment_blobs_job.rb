# frozen_string_literal: true

# BackfillEmailAttachmentBlobsJob - Download missing email attachment content
#
# SSoT: Finds EmailAttachment records without storage_blob_id and downloads
# the content from Microsoft Graph, storing it via StorageBlob (deduplication).
#
# FRC (Jan 2026): Fixes issue where older emails had attachment metadata
# but content was never downloaded (sync_attachments! was skipping them).
#
# Usage:
#   BackfillEmailAttachmentBlobsJob.perform_later(batch_size: 100)
#
class BackfillEmailAttachmentBlobsJob < ApplicationJob
  queue_as :low

  def perform(batch_size: 100, mailbox: nil)
    Rails.logger.info "[BackfillAttachmentBlobs] Starting backfill (batch_size: #{batch_size})"

    # Find emails with attachments that are missing blobs
    query = EmailAttachment.where(storage_blob_id: nil)

    if mailbox.present?
      email_ids = SyncedEmail.where(mailbox_owner_email: mailbox).pluck(:id)
      query = query.where(email_warehouse_id: email_ids)
    end

    # Group by email to avoid fetching same email multiple times
    email_ids_with_missing = query.distinct.pluck(:email_warehouse_id).first(batch_size)

    if email_ids_with_missing.empty?
      Rails.logger.info "[BackfillAttachmentBlobs] No emails with missing attachment blobs"
      return { processed: 0, uploaded: 0, errors: 0 }
    end

    Rails.logger.info "[BackfillAttachmentBlobs] Processing #{email_ids_with_missing.count} emails"

    uploaded = 0
    errors = 0

    email_ids_with_missing.each do |email_id|
      email = SyncedEmail.find_by(id: email_id)
      next unless email

      begin
        # sync_attachments! will now only download missing blobs (Jan 2026 fix)
        email.sync_attachments!(force: false)
        uploaded += 1
        print "."
      rescue => e
        Rails.logger.error "[BackfillAttachmentBlobs] Error for email #{email_id}: #{e.message}"
        errors += 1
      end
    end

    puts ""
    Rails.logger.info "[BackfillAttachmentBlobs] Completed: #{uploaded} emails processed, #{errors} errors"

    # Check if more work remains
    remaining = EmailAttachment.where(storage_blob_id: nil).count
    if remaining > 0
      Rails.logger.info "[BackfillAttachmentBlobs] #{remaining} attachments still missing blobs - queuing next batch"
      BackfillEmailAttachmentBlobsJob.set(wait: 5.seconds).perform_later(batch_size: batch_size, mailbox: mailbox)
    end

    { processed: email_ids_with_missing.count, uploaded: uploaded, errors: errors, remaining: remaining }
  end
end
