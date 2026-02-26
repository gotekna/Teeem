# frozen_string_literal: true

# RetryPendingAttachmentBlobsJob - Retry downloading attachment blobs that failed
#
# Handles TWO cases:
#   1. WarehouseDocument exists but no blob (step 2 of two-step sync failed)
#   2. SyncedEmail has_attachments=true but NO WarehouseDocuments at all
#      (sync_attachments! was deferred during initial bulk import - Feb 2026 metadata-first fix)
#
# FRC (Feb 2026): The two-step attachment sync (record_attachment_metadata! + download_pending_blobs!)
# has no retry mechanism. If step 2 fails, metadata records are orphaned forever.
# This job is the safety net that catches those orphans AND deferred attachments.
#
# Usage:
#   RetryPendingAttachmentBlobsJob.perform_later(batch_size: 50)
#
class RetryPendingAttachmentBlobsJob < ApplicationJob
  include DeduplicatableJob

  queue_as :default

  MAX_RUNTIME_SECONDS = 5 * 60 # 5 minutes

  # Memory guard: stop processing if total dyno RSS exceeds this (MB)
  # Shared worker dyno is 1024MB quota. Baseline RSS from SolidQueue + Xero is ~820MB.
  # R14 = warning at memory_total > 1024MB. R15 = kill at ~1.5x quota.
  MEMORY_ABORT_MB = 950

  # Hard cap on batch_size regardless of stale queue args (same pattern as UploadEmailsToStorageJob)
  MAX_BATCH_SIZE = 10

  def perform(batch_size: 50)
    @started_at = Time.current
    batch_size = [batch_size, MAX_BATCH_SIZE].min
    total_retried = 0
    total_errors = 0
    @memory_exceeded = false

    # === Case 1: Orphaned metadata (WarehouseDocument exists, no blob) ===
    # FRC (Feb 2026): Exclude permanently_failed attachments (e.g. unsupported
    # referenceAttachment type). Without this filter, the job re-processes the same
    # ~800x-failed attachments every 5 minutes, wasting memory and MS Graph API calls.
    tenant_ids = WarehouseDocument.unscoped
      .where(source_type: "email_attachment", storage_blob_id: nil)
      .where("metadata->>'blob_status' IS NULL OR metadata->>'blob_status' != 'permanently_failed'")
      .distinct
      .pluck(:tenant_id)
      .compact

    Rails.logger.info "[RetryPendingAttachmentBlobs] Case 1: #{tenant_ids.count} tenant(s) with orphaned blobs"

    tenant_ids.each do |tid|
      break unless time_remaining?

      tenant = Tenant.find_by(id: tid)
      next unless tenant

      ActsAsTenant.with_tenant(tenant) do
        email_ids = WarehouseDocument
          .where(source_type: "email_attachment", storage_blob_id: nil)
          .where("metadata->>'blob_status' IS NULL OR metadata->>'blob_status' != 'permanently_failed'")
          .where("metadata->>'synced_email_id' IS NOT NULL")
          .distinct
          .pluck(Arel.sql("metadata->>'synced_email_id'"))
          .compact
          .map(&:to_i)
          .first(batch_size)

        Rails.logger.info "[RetryPendingAttachmentBlobs] Tenant #{tid}: #{email_ids.count} emails with orphaned blobs"

        email_ids.each do |email_id|
          break unless time_remaining?
          break if memory_exceeded?

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

    # === Case 2: Deferred attachments (has_attachments=true, no WarehouseDocuments at all) ===
    # FRC (Feb 2026): During initial bulk import, sync_attachments! is skipped for speed.
    # This catches those emails and syncs their attachments in the background.
    if time_remaining?
      deferred_tenant_ids = SyncedEmail.unscoped
        .where(has_attachments: true)
        .where(content_unavailable: false)
        .where.not(outlook_id: [nil, ""])
        .where.not(mailbox_owner_email: [nil, ""])
        .where("NOT EXISTS (SELECT 1 FROM warehouse_documents WHERE warehouse_documents.linkable_type = 'SyncedEmail' AND warehouse_documents.linkable_id = synced_emails.id AND warehouse_documents.source_type = 'email_attachment')")
        .distinct
        .pluck(:tenant_id)
        .compact

      deferred_count = 0

      deferred_tenant_ids.each do |tid|
        break unless time_remaining?

        tenant = Tenant.find_by(id: tid)
        next unless tenant

        ActsAsTenant.with_tenant(tenant) do
          deferred_emails = SyncedEmail
            .where(has_attachments: true)
            .where(content_unavailable: false)
            .where.not(outlook_id: [nil, ""])
            .where.not(mailbox_owner_email: [nil, ""])
            .where("NOT EXISTS (SELECT 1 FROM warehouse_documents WHERE warehouse_documents.linkable_type = 'SyncedEmail' AND warehouse_documents.linkable_id = synced_emails.id AND warehouse_documents.source_type = 'email_attachment')")
            .order(:id)
            .limit(batch_size)

          Rails.logger.info "[RetryPendingAttachmentBlobs] Tenant #{tid}: #{deferred_emails.count} emails with deferred attachments"

          deferred_emails.each do |email|
            break unless time_remaining?
            break if memory_exceeded?

            begin
              email.sync_attachments!
              total_retried += 1
              deferred_count += 1
            rescue StandardError => e
              total_errors += 1
              Rails.logger.error "[RetryPendingAttachmentBlobs] Deferred sync failed for email #{email.id}: #{e.message}"
            end
          end
        end
      end

      Rails.logger.info "[RetryPendingAttachmentBlobs] Case 2: #{deferred_count} deferred attachments synced" if deferred_count > 0
    end

    Rails.logger.info "[RetryPendingAttachmentBlobs] Done: retried=#{total_retried}, errors=#{total_errors}"
  end

  private

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME_SECONDS
  end

  # Check memory every 5 calls (avoid overhead of reading /proc on every email)
  def memory_exceeded?
    return true if @memory_exceeded

    @memory_check_counter = (@memory_check_counter || 0) + 1
    return false unless @memory_check_counter % 5 == 0

    GC.start
    rss = current_rss_mb
    if rss > MEMORY_ABORT_MB
      Rails.logger.warn "[RetryPendingAttachmentBlobs] Memory high (#{rss}MB > #{MEMORY_ABORT_MB}MB), stopping"
      @memory_exceeded = true
    end
    @memory_exceeded
  end

  # ⚠️ DO NOT SIMPLIFY - Must sum ALL process RSS (Feb 2026)
  # See UploadEmailsToStorageJob for full explanation.
  def current_rss_mb
    `ps -eo rss=`.strip.split("\n").sum { |l| l.strip.to_i } / 1024
  rescue StandardError
    0
  end
end
