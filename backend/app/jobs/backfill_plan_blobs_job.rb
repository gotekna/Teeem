# frozen_string_literal: true

# =============================================================================
# BackfillPlanBlobsJob - Backfill existing plan revisions with StorageBlob + WarehouseDocument
# =============================================================================
# Scans job_plan_revisions that have a legacy storage_file_id but no storage_blob_id.
# For each revision:
#   1. Downloads the file from the legacy S3 path via DocumentProviderAware
#   2. Creates a StorageBlob (content-hash deduplication)
#   3. Links the blob to the revision
#   4. Creates a WarehouseDocument linked to the Job
#
# Self-chaining in batches of 20. Idempotent - safe to re-run.
# Run via: BackfillPlanBlobsJob.perform_later
# =============================================================================
class BackfillPlanBlobsJob < ApplicationJob
  include DocumentProviderAware

  queue_as :low

  BATCH_SIZE = 20

  def perform(offset = 0)
    # Unscoped: background jobs don't have tenant context
    revisions = JobPlanRevision.unscoped
      .where(storage_blob_id: nil)
      .where.not(storage_file_id: [nil, ""])
      .includes(job_plan: { job: :tenant })
      .order(:id)
      .offset(offset)
      .limit(BATCH_SIZE)

    if revisions.empty?
      Rails.logger.info "[BackfillPlanBlobsJob] Complete. No more revisions to process."
      return
    end

    processed = 0
    failed = 0

    revisions.each do |revision|
      tenant = revision.job_plan&.job&.tenant
      next unless tenant

      # Each revision needs tenant context for provider + WarehouseDocument
      ActsAsTenant.with_tenant(tenant) do
        setup_default_provider!
        backfill_revision!(revision)
      end
      processed += 1
    rescue => e
      failed += 1
      Rails.logger.error "[BackfillPlanBlobsJob] Failed revision #{revision.id}: #{e.message}"
    end

    Rails.logger.info "[BackfillPlanBlobsJob] Batch done: #{processed} processed, #{failed} failed (offset: #{offset})"

    # Self-chain for next batch if we got a full batch
    if revisions.size == BATCH_SIZE
      self.class.perform_later(offset + BATCH_SIZE)
    else
      Rails.logger.info "[BackfillPlanBlobsJob] All batches complete."
    end
  rescue DocumentProviders::NotConnectedError => e
    Rails.logger.error "[BackfillPlanBlobsJob] Storage not connected: #{e.message}"
  end

  private

  def backfill_revision!(revision)
    job = revision.job_plan&.job
    return unless job

    file_ref = revision.storage_item_id.presence || revision.storage_file_id
    return unless file_ref.present?

    # Download from legacy path
    content = download_from_provider(file_ref)
    unless content
      Rails.logger.warn "[BackfillPlanBlobsJob] Could not download revision #{revision.id} (ref: #{file_ref})"
      return
    end

    filename = revision.file_name.presence || "plan_#{revision.id}.pdf"

    # Create StorageBlob with content-hash deduplication
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: "application/pdf"
    )

    # Link blob to revision
    revision.update_columns(storage_blob_id: blob.id)

    # Create WarehouseDocument for File Warehouse visibility
    plans_folder = WarehouseFolder.where(warehouse_type: "job", tab_key: "plans").enabled.first

    WarehouseDocumentCreator.create!(
      filename: filename,
      source_type: "job",
      linkable: job,
      storage_blob: blob,
      warehouse_folder_id: plans_folder&.id,
      file_size: content.bytesize,
      content_type: "application/pdf"
    )
    blob.increment_reference!

    Rails.logger.info "[BackfillPlanBlobsJob] Backfilled revision #{revision.id} → blob #{blob.id}"
  end
end
