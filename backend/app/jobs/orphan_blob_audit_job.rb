# frozen_string_literal: true

# OrphanBlobAuditJob - Weekly safety net for orphaned StorageBlobs
#
# FRC (Feb 2026): StorageBlobs were created without WarehouseDocuments by 38 of 39
# callers using StorageBlob.find_or_create_for_content! directly instead of
# WarehouseDocumentCreator. This job is the safety net that catches orphans.
#
# What it does:
#   1. Scans ALL 20+ models/tables with storage_blob_id
#   2. Finds blobs with NO references from ANY model (truly orphaned)
#   3. Logs findings to Rails logger + Sentry (does NOT auto-delete)
#   4. Reports stats for the Data Warehouse dashboard
#
# SSoT: Uses BlobReferenceScanner (app/services/blob_reference_scanner.rb)
#
# Usage:
#   OrphanBlobAuditJob.perform_later
#   OrphanBlobAuditJob.perform_later(min_age_days: 7)
#
class OrphanBlobAuditJob < ApplicationJob
  queue_as :low

  def perform(min_age_days: 7)
    Rails.logger.info "[OrphanBlobAudit] Starting audit (min_age: #{min_age_days} days)"

    cutoff_date = min_age_days.days.ago

    # Collect ALL referenced blob IDs across every model/table (SSoT: BlobReferenceScanner)
    all_referenced_ids = BlobReferenceScanner.all_referenced_blob_ids

    # Find truly orphaned blobs (older than cutoff, not referenced anywhere)
    orphaned_scope = StorageBlob.where("created_at < ?", cutoff_date)
    orphaned_scope = orphaned_scope.where.not(id: all_referenced_ids.to_a) if all_referenced_ids.any?

    orphan_count = orphaned_scope.count
    total_blobs = StorageBlob.count

    if orphan_count == 0
      Rails.logger.info "[OrphanBlobAudit] No orphaned blobs found (#{total_blobs} total)"
      return
    end

    # Calculate size
    orphan_size_bytes = orphaned_scope.sum(:file_size)
    orphan_size_mb = (orphan_size_bytes.to_f / 1024 / 1024).round(2)

    # Group by content type for visibility
    by_type = orphaned_scope.group(:content_type).count
    by_month = orphaned_scope.group("DATE_TRUNC('month', created_at)").count

    message = "[OrphanBlobAudit] Found #{orphan_count} orphaned blobs " \
              "(#{orphan_size_mb} MB) out of #{total_blobs} total. " \
              "By type: #{by_type.sort_by { |_, v| -v }.first(5).to_h}. " \
              "Run 'rails blob:cleanup:orphaned' to review."

    Rails.logger.warn message

    # Report to Sentry if significant (>100 orphans or >100MB)
    if defined?(Sentry) && (orphan_count > 100 || orphan_size_mb > 100)
      Sentry.capture_message(message, level: :warning) do |scope|
        scope.set_tags(source: "orphan_blob_audit")
        scope.set_context("orphan_stats", {
          orphan_count: orphan_count,
          total_blobs: total_blobs,
          orphan_size_mb: orphan_size_mb,
          by_content_type: by_type,
          by_month: by_month.transform_keys(&:to_s)
        })
      end
    end

    Rails.logger.info "[OrphanBlobAudit] Audit complete"
  end

end
