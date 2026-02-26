# frozen_string_literal: true

# Phase 5: Flat Storage Migration - ONE Universal Migration Job
#
# Migrates ALL document types to content-addressed blob storage.
# After migration, physical files NEVER move again - only DB folder changes.
#
# Usage:
#   # Dry run (no changes)
#   MigrateAllDocumentsToBlobStorageJob.perform_now(dry_run: true, limit: 100)
#
#   # Full migration
#   MigrateAllDocumentsToBlobStorageJob.perform_now(dry_run: false)
#
#   # Filter by source type
#   MigrateAllDocumentsToBlobStorageJob.perform_now(source_type: 'email')
#
# Via Heroku:
#   heroku run rails runner "MigrateAllDocumentsToBlobStorageJob.perform_now(dry_run: true, limit: 100)" --app teeemlive
#
# Progress is logged. Can be safely re-run (idempotent).
#
class MigrateAllDocumentsToBlobStorageJob < ApplicationJob
  queue_as :low

  BATCH_SIZE = 100
  LOG_INTERVAL = 500

  def perform(options = {})
    dry_run = options.fetch(:dry_run, true)
    limit = options[:limit]
    source_type = options[:source_type]

    start_time = Time.current
    stats = { processed: 0, migrated: 0, skipped: 0, deduped: 0, errors: 0, error_details: [] }

    Rails.logger.info "[BlobMigration] Starting (dry_run=#{dry_run}, source_type=#{source_type || 'all'}, limit=#{limit || 'unlimited'})..."

    # Query WarehouseDocuments that need migration (no blob yet)
    scope = WarehouseDocument.includes(:documentable, :storage_blob)
                             .where(storage_blob_id: nil)
    scope = scope.where(source_type: source_type) if source_type.present?
    scope = scope.limit(limit) if limit

    provider = get_storage_provider

    scope.find_each(batch_size: BATCH_SIZE) do |wd|
      stats[:processed] += 1

      begin
        result = migrate_document(wd, provider, dry_run: dry_run)
        stats[result] += 1
      rescue StandardError => e
        stats[:errors] += 1
        stats[:error_details] << { id: wd.id, error: e.message } if stats[:error_details].size < 100
        Rails.logger.error "[BlobMigration] Error WD##{wd.id}: #{e.message}"
      end

      log_progress(stats) if (stats[:processed] % LOG_INTERVAL).zero?
    end

    elapsed = Time.current - start_time
    final_stats = stats.except(:error_details).merge(elapsed_seconds: elapsed.round(1))

    Rails.logger.info "[BlobMigration] Complete! #{final_stats.inspect}"
    Rails.logger.info "[BlobMigration] First 10 errors: #{stats[:error_details].first(10).inspect}" if stats[:errors] > 0

    final_stats
  end

  private

  def get_storage_provider
    # SSoT (Jan 2026): Use tenant for storage provider
    tenant = ActsAsTenant.current_tenant
    if tenant
      DocumentProviders.for_tenant(tenant)
    else
      Rails.logger.warn "[BlobMigration] No tenant context - using first organization"
      DocumentProviders.for_organization(Organization.first)
    end
  end

  # Memory-safe: downloads to Tempfile, uses find_or_create_from_file! for disk-backed hash+upload
  def migrate_document(wd, provider, dry_run:)
    # Get legacy path from the source record
    old_path = wd.legacy_storage_path
    unless old_path.present?
      Rails.logger.debug "[BlobMigration] WD##{wd.id}: No legacy path, skipping"
      return :skipped
    end

    # Download to Tempfile (memory-safe: streams to disk, not heap)
    tempfile = nil
    begin
      if provider.respond_to?(:download_to_tempfile)
        tempfile = provider.download_to_tempfile(old_path)
      else
        # Fallback for providers without streaming support (e.g., SharePoint)
        content = provider.download_file(old_path)
        unless content.present?
          Rails.logger.warn "[BlobMigration] WD##{wd.id}: Empty content at #{old_path}, skipping"
          return :skipped
        end
        tempfile = Tempfile.new(["blob_migration_#{wd.id}", File.extname(old_path)], binmode: true)
        tempfile.write(content)
        tempfile.flush
        tempfile.rewind
        content = nil # Release String from heap
      end
    rescue DocumentProviders::NotFoundError
      Rails.logger.warn "[BlobMigration] WD##{wd.id}: File not found at #{old_path}, skipping"
      return :skipped
    end

    if tempfile.nil? || tempfile.size == 0
      Rails.logger.warn "[BlobMigration] WD##{wd.id}: Empty content at #{old_path}, skipping"
      tempfile&.close! rescue nil
      return :skipped
    end

    # Disk-backed hash for dedup check (4KB buffer, O(1) memory)
    content_hash = Digest::SHA256.file(tempfile.path).hexdigest

    # Check if blob already exists (deduplication!)
    existing_blob = StorageBlob.find_by(content_hash: content_hash)
    if existing_blob
      Rails.logger.info "[BlobMigration] WD##{wd.id}: Dedup -> blob##{existing_blob.id}"
      unless dry_run
        wd.update!(storage_blob_id: existing_blob.id)
        existing_blob.increment_reference!
      end
      tempfile.close! rescue nil
      return :deduped
    end

    if dry_run
      tempfile.close! rescue nil
      return :migrated
    end

    # Use StorageBlob.find_or_create_from_file! for disk-backed upload with race-condition handling
    filename = wd.ui_name || File.basename(old_path)
    content_type = wd.content_type || detect_content_type(File.extname(old_path).presence || detect_extension(wd))

    blob = StorageBlob.find_or_create_from_file!(
      tempfile.path,
      filename: filename,
      content_type: content_type
    )

    # Link warehouse document to blob
    wd.update!(storage_blob_id: blob.id)
    blob.increment_reference!

    Rails.logger.info "[BlobMigration] WD##{wd.id}: Migrated #{old_path} -> #{blob.storage_path}"
    :migrated
  ensure
    tempfile&.close! rescue nil
  end

  def log_progress(stats)
    Rails.logger.info "[BlobMigration] Progress: processed=#{stats[:processed]}, migrated=#{stats[:migrated]}, skipped=#{stats[:skipped]}, deduped=#{stats[:deduped]}, errors=#{stats[:errors]}"
  end

  def detect_extension(wd)
    # Try to detect extension from content_type or display_name
    if wd.content_type.present?
      case wd.content_type
      when /pdf/ then ".pdf"
      when /email|message/ then ".eml"
      when /jpeg|jpg/ then ".jpg"
      when /png/ then ".png"
      when /word|docx/ then ".docx"
      when /excel|xlsx/ then ".xlsx"
      else ""
      end
    elsif wd.ui_name.present?
      File.extname(wd.ui_name)
    else
      ""
    end
  end

  # SSoT: ContentTypeDetector (lib/utils/content_type_detector.rb)
  # Note: accepts extension (e.g., ".pdf") or filename
  def detect_content_type(extension_or_filename)
    ContentTypeDetector.detect(extension_or_filename)
  end
end
