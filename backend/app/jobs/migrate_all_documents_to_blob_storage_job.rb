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
    DocumentProviders.for_organization(Organization.first)
  end

  def migrate_document(wd, provider, dry_run:)
    # Get legacy path from the source record
    old_path = wd.legacy_storage_path
    unless old_path.present?
      Rails.logger.debug "[BlobMigration] WD##{wd.id}: No legacy path, skipping"
      return :skipped
    end

    # Download content from old location
    begin
      content = provider.download_file(old_path)
    rescue DocumentProviders::NotFoundError
      Rails.logger.warn "[BlobMigration] WD##{wd.id}: File not found at #{old_path}, skipping"
      return :skipped
    end

    unless content.present?
      Rails.logger.warn "[BlobMigration] WD##{wd.id}: Empty content at #{old_path}, skipping"
      return :skipped
    end

    # Calculate hash for deduplication
    content_hash = Digest::SHA256.hexdigest(content)
    extension = File.extname(old_path).presence || detect_extension(wd)

    # Check if blob already exists (deduplication!)
    existing_blob = StorageBlob.find_by(content_hash: content_hash)
    if existing_blob
      Rails.logger.info "[BlobMigration] WD##{wd.id}: Dedup -> blob##{existing_blob.id}"
      unless dry_run
        wd.update!(storage_blob_id: existing_blob.id)
        existing_blob.increment_reference!
        # Don't delete old file yet - might be needed by other records
      end
      return :deduped
    end

    return :migrated if dry_run

    # Upload to flat blob storage: Blobs/{first2}/{hash}.ext
    new_path = "Blobs/#{content_hash[0..1]}/#{content_hash}#{extension}"

    provider.upload_file(
      File.dirname(new_path),
      content,
      File.basename(new_path),
      content_type: wd.content_type || detect_content_type(extension)
    )

    # Create blob record
    blob = StorageBlob.create!(
      content_hash: content_hash,
      storage_path: new_path,
      file_size: content.bytesize,
      content_type: wd.content_type || detect_content_type(extension),
      original_filename: wd.display_name || File.basename(old_path),
      reference_count: 1
    )

    # Link warehouse document to blob
    wd.update!(storage_blob_id: blob.id)

    # Optionally delete old file (commented out for safety - enable after verification)
    # provider.delete_file(old_path)

    Rails.logger.info "[BlobMigration] WD##{wd.id}: Migrated #{old_path} -> #{new_path}"
    :migrated
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
    elsif wd.display_name.present?
      File.extname(wd.display_name)
    else
      ""
    end
  end

  def detect_content_type(extension)
    case extension.downcase
    when ".pdf" then "application/pdf"
    when ".eml" then "message/rfc822"
    when ".jpg", ".jpeg" then "image/jpeg"
    when ".png" then "image/png"
    when ".docx" then "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    when ".xlsx" then "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else "application/octet-stream"
    end
  end
end
