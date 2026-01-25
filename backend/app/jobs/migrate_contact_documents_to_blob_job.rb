# frozen_string_literal: true

# MigrateContactDocumentsToBlobJob - Migrate orphaned ContactDocuments to StorageBlob
#
# Root Cause (Jan 2026):
#   XeroAttachmentSyncService used path_for(:contacts) but warehouse_root_folders
#   only had 'contact' (singular). This returned nil, so 11,462 files went to
#   'corporate/unassigned/' fallback instead of proper 'Contacts/...' paths.
#
# What this job does:
#   1. Finds ContactDocuments with storage_item_id in 'corporate/unassigned/'
#   2. Downloads file content from Wasabi
#   3. Creates StorageBlob (with deduplication via content_hash)
#   4. Links ContactDocument to StorageBlob
#   5. Updates storage_path to proper 'Contacts/...' structure
#
# Usage:
#   MigrateContactDocumentsToBlobJob.perform_later           # Process all
#   MigrateContactDocumentsToBlobJob.perform_later(limit: 100) # Process batch
#   MigrateContactDocumentsToBlobJob.perform_now(dry_run: true) # Preview changes
#
class MigrateContactDocumentsToBlobJob < ApplicationJob
  queue_as :low

  # Allow retry on transient S3 errors
  retry_on Aws::S3::Errors::ServiceError, wait: 30.seconds, attempts: 3

  def perform(limit: nil, dry_run: false, batch_size: 100)
    @dry_run = dry_run
    @stats = { found: 0, migrated: 0, skipped: 0, errors: 0, deduplicated: 0 }
    @errors = []

    log_info "Starting ContactDocument blob migration (dry_run: #{dry_run}, limit: #{limit || 'all'})"

    scope = orphaned_contact_documents
    scope = scope.limit(limit) if limit.present?

    @stats[:found] = scope.count
    log_info "Found #{@stats[:found]} ContactDocuments to migrate"

    scope.find_each(batch_size: batch_size) do |doc|
      migrate_document(doc)
    rescue StandardError => e
      @stats[:errors] += 1
      @errors << { id: doc.id, error: e.message }
      log_error "Error migrating ContactDocument ##{doc.id}: #{e.message}"
    end

    log_summary
    @stats
  end

  private

  # Find ContactDocuments that need migration:
  # - Have storage_item_id pointing to 'corporate/unassigned/'
  # - Don't have storage_blob_id linked yet
  def orphaned_contact_documents
    ContactDocument
      .where(storage_blob_id: nil)
      .where("storage_item_id LIKE ?", "corporate/unassigned/%")
  end

  def migrate_document(doc)
    wasabi_path = doc.storage_item_id
    return skip_document(doc, "No storage_item_id") if wasabi_path.blank?

    # Download file from Wasabi
    content = download_from_wasabi(wasabi_path)
    return skip_document(doc, "File not found on Wasabi") if content.nil?

    filename = extract_filename(wasabi_path)
    content_type = doc.mime_type || Marcel::MimeType.for(name: filename)

    if @dry_run
      log_info "[DRY RUN] Would migrate ContactDocument ##{doc.id}: #{filename} (#{content.bytesize} bytes)"
      @stats[:migrated] += 1
      return
    end

    # Create or find StorageBlob (deduplication via content_hash)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    # Check if this was a deduplication (existing blob)
    was_deduplicated = blob.reference_count > 1
    @stats[:deduplicated] += 1 if was_deduplicated

    # Link ContactDocument to StorageBlob
    doc.update!(
      storage_blob_id: blob.id,
      storage_path: compute_correct_path(doc)
    )

    # Update reference count
    blob.increment_reference!

    log_info "Migrated ContactDocument ##{doc.id} -> StorageBlob ##{blob.id} (#{was_deduplicated ? 'deduplicated' : 'new'})"
    @stats[:migrated] += 1
  end

  def skip_document(doc, reason)
    @stats[:skipped] += 1
    log_info "Skipped ContactDocument ##{doc.id}: #{reason}"
  end

  def download_from_wasabi(path)
    s3_client.get_object(
      bucket: wasabi_bucket,
      key: path
    ).body.read
  rescue Aws::S3::Errors::NoSuchKey
    nil
  end

  def extract_filename(path)
    File.basename(path)
  end

  # Compute the correct storage path based on Contact
  def compute_correct_path(doc)
    contact = doc.contact
    return doc.storage_path if contact.nil?

    contact_name = contact.display_name.presence || "Contact-#{contact.id}"
    # Sanitize for path use
    safe_name = contact_name.gsub(/[<>:"|?*\\\/]/, "_")

    # Use document type folder or default
    folder = doc.document_type_record&.folder.presence || doc.folder.presence || "Documents"

    "Contacts/#{safe_name}/#{folder}"
  end

  def s3_client
    @s3_client ||= begin
      cred = S3CompatibleCredential.active.first
      raise "No active S3CompatibleCredential found" unless cred

      Aws::S3::Client.new(
        endpoint: cred.endpoint,
        access_key_id: cred.access_key_id,
        secret_access_key: cred.secret_access_key,
        region: cred.region || "us-east-1",
        force_path_style: true
      )
    end
  end

  def wasabi_bucket
    @wasabi_bucket ||= StorageConfiguration.bucket
  end

  def log_info(message)
    Rails.logger.info "[MigrateContactDocumentsToBlob] #{message}"
  end

  def log_error(message)
    Rails.logger.error "[MigrateContactDocumentsToBlob] #{message}"
  end

  def log_summary
    log_info "=" * 60
    log_info "Migration Summary:"
    log_info "  Found:        #{@stats[:found]}"
    log_info "  Migrated:     #{@stats[:migrated]}"
    log_info "  Deduplicated: #{@stats[:deduplicated]}"
    log_info "  Skipped:      #{@stats[:skipped]}"
    log_info "  Errors:       #{@stats[:errors]}"
    if @errors.any?
      log_info "  Error details:"
      @errors.first(10).each { |e| log_info "    ##{e[:id]}: #{e[:error]}" }
      log_info "    ... and #{@errors.size - 10} more" if @errors.size > 10
    end
    log_info "=" * 60
  end
end
