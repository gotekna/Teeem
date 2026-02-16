# frozen_string_literal: true

# RetryPendingAttachmentBlobsJob - Retry downloading attachment blobs that failed
#
# Finds WarehouseDocuments with source_type='email_attachment' and no storage_blob_id,
# then re-triggers sync_attachments! on their parent SyncedEmail to retry the download.
#
# FRC (Feb 2026): The two-step attachment sync (record_attachment_metadata! + download_pending_blobs!)
# has no retry mechanism. If step 2 fails, metadata records are orphaned forever.
# This job is the safety net that catches those orphans.
#
# Usage:
#   RetryPendingAttachmentBlobsJob.perform_later(batch_size: 50)
#
class RetryPendingAttachmentBlobsJob < ApplicationJob
  include DeduplicatableJob

  queue_as :default

  MAX_RUNTIME_SECONDS = 5 * 60 # 5 minutes

  def perform(batch_size: 50)
    @started_at = Time.current

    # Find all tenants with pending attachment blobs (unscoped to see all tenants)
    tenant_ids = WarehouseDocument.unscoped
      .where(source_type: "email_attachment", storage_blob_id: nil)
      .distinct
      .pluck(:tenant_id)
      .compact

    if tenant_ids.empty?
      Rails.logger.info "[RetryPendingAttachmentBlobs] No pending attachment blobs found"
      return
    end

    Rails.logger.info "[RetryPendingAttachmentBlobs] Found #{tenant_ids.count} tenant(s) with pending blobs"

    total_retried = 0
    total_errors = 0

    tenant_ids.each do |tid|
      break unless time_remaining?

      tenant = Tenant.find_by(id: tid)
      next unless tenant

      ActsAsTenant.with_tenant(tenant) do
        # Find emails with pending attachment blobs
        email_ids = WarehouseDocument
          .where(source_type: "email_attachment", storage_blob_id: nil)
          .where("metadata->>'synced_email_id' IS NOT NULL")
          .distinct
          .pluck(Arel.sql("metadata->>'synced_email_id'"))
          .compact
          .map(&:to_i)
          .first(batch_size)

        Rails.logger.info "[RetryPendingAttachmentBlobs] Tenant #{tid}: #{email_ids.count} emails with pending blobs"

        email_ids.each do |email_id|
          break unless time_remaining?

          email = SyncedEmail.find_by(id: email_id)
          next unless email

          begin
            email.sync_attachments!(force: true)
            total_retried += 1
          rescue StandardError => e
            total_errors += 1
            Rails.logger.error "[RetryPendingAttachmentBlobs] Failed for email #{email_id}: #{e.message}"
          end
        end
      end
    end

    Rails.logger.info "[RetryPendingAttachmentBlobs] Done: retried=#{total_retried}, errors=#{total_errors}"
  end

  private

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME_SECONDS
  end
end
