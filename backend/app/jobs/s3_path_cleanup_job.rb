# frozen_string_literal: true

# S3PathCleanupJob - Renames S3 objects to clean, human-readable paths
#
# Moves files within S3 (no re-download from SharePoint) using copy + delete.
# Updates storage_path in database to match new location.
#
# Usage:
#   # Rename a single document
#   S3PathCleanupJob.perform_later(document_id, document_type: 'JobDocument')
#
#   # Batch rename all documents with old-style paths
#   S3PathCleanupJob.rename_all_old_paths!
#
class S3PathCleanupJob < ApplicationJob
  queue_as :low

  # Batch method to queue all documents needing path cleanup
  def self.rename_all_old_paths!
    count = 0

    # Find JobDocuments on S3 with old-style paths (contain encoded chars or verbose naming)
    JobDocument.where(storage_provider: 's3_compatible')
               .where.not(storage_path: nil)
               .find_each do |doc|
      next if clean_path?(doc.storage_path)

      perform_later(doc.id, document_type: 'JobDocument')
      count += 1
    end

    Rails.logger.info "[S3PathCleanup] Queued #{count} JobDocuments for path cleanup"
    count
  end

  # Check if path is already clean (lowercase, no spaces, no encoded chars)
  def self.clean_path?(path)
    return true if path.blank?

    # Clean paths: lowercase, no spaces, no URL encoding, starts with type prefix
    path.match?(/\A(jobs|corporate|people)\/\d+\/[a-z0-9\-\/\.]+\z/)
  end

  def perform(document_id, options = {})
    document_type = options[:document_type] || 'JobDocument'
    klass = document_type.constantize

    document = klass.find(document_id)

    # Skip if not on S3
    unless document.storage_provider == 's3_compatible'
      Rails.logger.info "[S3PathCleanup] #{document_type} #{document_id} not on S3, skipping"
      return { status: 'skipped', reason: 'not_s3' }
    end

    old_path = document.storage_path
    old_key = document.storage_item_id

    # Skip if already clean
    if self.class.clean_path?(old_path)
      Rails.logger.info "[S3PathCleanup] #{document_type} #{document_id} already has clean path"
      return { status: 'skipped', reason: 'already_clean' }
    end

    # Calculate new clean path
    new_path = build_clean_path(document, document_type)
    new_key = new_path # For S3, key = path

    # Skip if paths are the same
    if old_key == new_key
      Rails.logger.info "[S3PathCleanup] #{document_type} #{document_id} paths identical"
      return { status: 'skipped', reason: 'same_path' }
    end

    Rails.logger.info "[S3PathCleanup] Renaming #{document_type} #{document_id}"
    Rails.logger.info "[S3PathCleanup]   FROM: #{old_key}"
    Rails.logger.info "[S3PathCleanup]   TO:   #{new_key}"

    # Get S3 client
    credential = S3CompatibleCredential.active.connected.first
    raise "No S3 credential configured" unless credential

    s3_client = Aws::S3::Client.new(
      endpoint: credential.endpoint,
      region: credential.region,
      access_key_id: credential.access_key_id,
      secret_access_key: credential.secret_access_key,
      force_path_style: true
    )

    bucket = credential.bucket

    begin
      # Step 1: Copy object to new key
      s3_client.copy_object(
        bucket: bucket,
        copy_source: "#{bucket}/#{old_key}",
        key: new_key
      )
      Rails.logger.info "[S3PathCleanup] Copied to new path"

      # Step 2: Verify copy exists
      s3_client.head_object(bucket: bucket, key: new_key)
      Rails.logger.info "[S3PathCleanup] Verified new object exists"

      # Step 3: Update database
      document.update!(
        storage_item_id: new_key,
        storage_path: new_path
      )
      Rails.logger.info "[S3PathCleanup] Updated database"

      # Step 4: Delete old object
      s3_client.delete_object(bucket: bucket, key: old_key)
      Rails.logger.info "[S3PathCleanup] Deleted old object"

      {
        status: 'completed',
        document_id: document_id,
        old_path: old_key,
        new_path: new_key
      }

    rescue Aws::S3::Errors::NoSuchKey => e
      Rails.logger.error "[S3PathCleanup] Source file not found: #{old_key}"
      { status: 'error', reason: 'source_not_found', error: e.message }

    rescue StandardError => e
      Rails.logger.error "[S3PathCleanup] Failed: #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")
      raise
    end
  end

  private

  # Build clean path for document (same logic as DocumentMigrationJob)
  def build_clean_path(document, document_type)
    case document_type
    when 'JobDocument'
      job = document.job
      subfolder = slugify_path(document.folder_path.presence || "documents")
      filename = slugify_filename(document.file_name)
      "jobs/#{job.id}/#{subfolder}/#{filename}"

    when 'CorporateCompanyDocument'
      company = document.corporate_company
      if company
        folder = slugify_path(document.folder.presence || "documents")
        filename = slugify_filename(document.file_name)
        "corporate/#{company.id}/#{folder}/#{filename}"
      else
        "corporate/unassigned/#{slugify_filename(document.file_name)}"
      end

    when 'PeopleDocument'
      contact = document.contact
      if contact
        folder = slugify_path(document.folder.presence || "documents")
        filename = slugify_filename(document.file_name)
        "people/#{contact.id}/#{folder}/#{filename}"
      else
        "people/unassigned/#{slugify_filename(document.file_name)}"
      end

    else
      "documents/#{slugify_filename(document.file_name)}"
    end
  end

  # Convert path segments to URL-friendly slugs
  def slugify_path(path)
    return "documents" if path.blank?
    path.split('/').map { |segment| slugify(segment) }.join('/')
  end

  # Convert filename to URL-friendly format while preserving extension
  def slugify_filename(filename)
    return "untitled" if filename.blank?
    ext = File.extname(filename)
    base = File.basename(filename, ext)
    "#{slugify(base)}#{ext.downcase}"
  end

  # Convert string to URL-friendly slug
  def slugify(text)
    return "untitled" if text.blank?
    text.to_s
        .downcase
        .gsub(/^\d+\s*[-_]?\s*/, '')  # Remove leading numbers like "03 - "
        .gsub(/[^a-z0-9\s-]/, '')     # Remove special chars except spaces/hyphens
        .gsub(/\s+/, '-')              # Spaces to hyphens
        .gsub(/-+/, '-')               # Collapse multiple hyphens
        .gsub(/^-|-$/, '')             # Trim leading/trailing hyphens
        .presence || "item"
  end
end
