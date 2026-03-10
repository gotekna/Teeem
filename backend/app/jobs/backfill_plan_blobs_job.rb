# frozen_string_literal: true

# =============================================================================
# BackfillPlanBlobsJob - Backfill existing plan revisions with StorageBlob + WarehouseDocument
# =============================================================================
# Scans job_plan_revisions that have a legacy storage_file_id but no storage_blob_id.
# For each revision:
#   1. Downloads the file from the legacy S3 path via S3 provider
#   2. Creates a StorageBlob (content-hash deduplication)
#   3. Links the blob to the revision
#   4. Creates a WarehouseDocument linked to the Job
#
# Self-chaining in batches of 20. Idempotent - safe to re-run.
# Run via: BackfillPlanBlobsJob.perform_later
#
# FRC (Mar 2026): Always queries from offset 0. Successfully backfilled
# revisions leave the where(storage_blob_id: nil) result set, so offset-based
# pagination would skip unprocessed revisions. Max 10 iterations to prevent
# infinite loops from permanently-failing revisions.
# =============================================================================
class BackfillPlanBlobsJob < ApplicationJob
  queue_as :low

  BATCH_SIZE = 20
  MAX_ITERATIONS = 10

  def perform(iteration = 0)
    if iteration >= MAX_ITERATIONS
      remaining = JobPlanRevision.unscoped.where(storage_blob_id: nil).where.not(storage_file_id: [nil, ""]).count
      Rails.logger.warn "[BackfillPlanBlobsJob] Stopped after #{MAX_ITERATIONS} iterations. #{remaining} revisions still unprocessed."
      return
    end

    # Always offset 0: successful backfills leave the result set
    revisions = JobPlanRevision.unscoped
      .where(storage_blob_id: nil)
      .where.not(storage_file_id: [nil, ""])
      .includes(job_plan: { job: :tenant })
      .order(:id)
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

      # Each revision needs tenant context for WarehouseDocument
      ActsAsTenant.with_tenant(tenant) do
        backfill_revision!(revision, tenant)
      end
      processed += 1
    rescue => e
      failed += 1
      Rails.logger.error "[BackfillPlanBlobsJob] Failed revision #{revision.id}: #{e.class}: #{e.message}"
    end

    Rails.logger.info "[BackfillPlanBlobsJob] Batch #{iteration + 1}: #{processed} processed, #{failed} failed"

    # Self-chain if there were successes (more work to do)
    # Stop if entire batch failed (all permanently broken)
    if processed > 0
      self.class.perform_later(iteration + 1)
    else
      remaining = JobPlanRevision.unscoped.where(storage_blob_id: nil).where.not(storage_file_id: [nil, ""]).count
      Rails.logger.warn "[BackfillPlanBlobsJob] Stopped - entire batch failed. #{remaining} revisions unprocessed."
    end
  end

  private

  def backfill_revision!(revision, tenant)
    job = revision.job_plan&.job
    return unless job

    file_ref = revision.storage_item_id.presence || revision.storage_file_id
    return unless file_ref.present?

    # Download from legacy S3 path using direct provider
    provider = build_provider(tenant)
    content = provider.download_file(file_ref)
    # Force binary encoding (FRC: prevents PDF corruption)
    content.force_encoding(Encoding::ASCII_8BIT) if content

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

  # Build S3 provider directly - no DocumentProviderAware setup needed
  def build_provider(tenant)
    @provider_cache ||= {}
    @provider_cache[tenant.id] ||= begin
      cred = S3CompatibleCredential.active.connected.first
      raise "No S3 credential configured" unless cred
      DocumentProviders::S3Compatible.new(cred, tenant: tenant)
    end
  end
end
