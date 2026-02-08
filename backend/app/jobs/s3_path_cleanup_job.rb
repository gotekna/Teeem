# frozen_string_literal: true

# S3PathCleanupJob - Renames S3 objects to clean, human-readable paths
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: WarehouseProvider.instance.path_for(:scope) (Jan 2026)  ║
# ║  - path_for(:jobs) → default "Jobs" (with job.job_code prefix)    ║
# ║  - path_for(:corporate) → default "Corporate"                     ║
# ║  - path_for(:people) → default "People"                           ║
# ╚═══════════════════════════════════════════════════════════════════╝
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
  # SSoT (Jan 2026): Uses WarehouseDocument instead of JobDocument
  def self.rename_all_old_paths!
    count = 0

    # Find WarehouseDocuments on S3 with old-style paths (contain encoded chars or verbose naming)
    WarehouseDocument.includes(:storage_blob)
                     .where("metadata->>'storage_provider' = ?", "s3_compatible")
                     .find_each do |doc|
      storage_path = doc.storage_blob&.storage_path
      next if storage_path.blank? || clean_path?(storage_path)

      perform_later(doc.id, document_type: 'WarehouseDocument')
      count += 1
    end

    Rails.logger.info "[S3PathCleanup] Queued #{count} WarehouseDocuments for path cleanup"
    count
  end

  # Check if path uses SSoT folder structure (TitleCase, proper prefixes)
  # SSoT: WarehouseProvider.instance.path_for(:scope) (Jan 2026)
  def self.clean_path?(path)
    return true if path.blank?

    # Get configured folder names from WarehouseProvider
    config = WarehouseProvider.instance
    jobs_folder = config&.path_for(:jobs) || "Jobs"
    corporate_folder = config&.path_for(:corporate) || "Corporate"
    people_folder = config&.path_for(:people) || "People"

    # SSoT paths: Configured folders, job_code format (J{id}), no URL encoding
    jobs_pattern = Regexp.escape(jobs_folder)
    corporate_pattern = Regexp.escape(corporate_folder)
    people_pattern = Regexp.escape(people_folder)

    path.match?(/\A(#{jobs_pattern}\/J\d+|#{corporate_pattern}\/\d+|#{corporate_pattern}\/#{people_pattern}\/\d+)\/[a-zA-Z0-9\-\/\._\s]+\z/)
  end

  # SSoT (Jan 2026): Uses WarehouseDocument instead of JobDocument
  def perform(document_id, options = {})
    document = WarehouseDocument.find(document_id)

    # Skip if not on S3
    storage_provider = document.meta("storage_provider")
    unless storage_provider == "s3_compatible"
      Rails.logger.info "[S3PathCleanup] WarehouseDocument #{document_id} not on S3, skipping"
      return { status: "skipped", reason: "not_s3" }
    end

    blob = document.storage_blob
    old_path = blob&.storage_path
    old_key = old_path

    # Skip if already clean
    if self.class.clean_path?(old_path)
      Rails.logger.info "[S3PathCleanup] WarehouseDocument #{document_id} already has clean path"
      return { status: "skipped", reason: "already_clean" }
    end

    # Calculate new clean path
    new_path = build_clean_path(document)
    new_key = new_path # For S3, key = path

    # Skip if paths are the same
    if old_key == new_key
      Rails.logger.info "[S3PathCleanup] WarehouseDocument #{document_id} paths identical"
      return { status: "skipped", reason: "same_path" }
    end

    Rails.logger.info "[S3PathCleanup] Renaming WarehouseDocument #{document_id}"
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

    bucket = WarehouseProvider.bucket

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

      # Step 3: Update StorageBlob path
      blob.update!(storage_path: new_path)
      Rails.logger.info "[S3PathCleanup] Updated database"

      # Step 4: Delete old object
      s3_client.delete_object(bucket: bucket, key: old_key)
      Rails.logger.info "[S3PathCleanup] Deleted old object"

      {
        status: "completed",
        document_id: document_id,
        old_path: old_key,
        new_path: new_key
      }

    rescue Aws::S3::Errors::NoSuchKey => e
      Rails.logger.error "[S3PathCleanup] Source file not found: #{old_key}"
      { status: "error", reason: "source_not_found", error: e.message }

    rescue StandardError => e
      Rails.logger.error "[S3PathCleanup] Failed: #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")
      raise
    end
  end

  private

  # Build clean path for document using SSoT from WarehouseProvider
  # SSoT (Jan 2026): Uses WarehouseDocument source_type to determine path structure
  def build_clean_path(document)
    config = WarehouseProvider.instance
    raise ArgumentError, "WarehouseProvider required for path generation" unless config

    source_type = document.source_type
    filename = clean_filename(document.original_filename || document.ui_name || "untitled")
    subfolder = clean_subfolder(document.folder_path.presence || "Documents")

    case source_type
    when "job"
      job = document.linkable
      raise ArgumentError, "WarehouseDocument #{document.id} has no linkable Job - cannot determine path" unless job&.is_a?(Job)

      job_code = job.job_code
      jobs_folder = config.path_for(:jobs) || "Jobs"
      "#{jobs_folder}/#{job_code}/#{subfolder}/#{filename}"

    when "corporate"
      company = document.linkable
      raise ArgumentError, "WarehouseDocument #{document.id} has no linkable Corporate - cannot determine path" unless company&.is_a?(Corporate)

      corporate_folder = config.path_for(:corporate) || "Corporate"
      "#{corporate_folder}/#{company.id}/#{subfolder}/#{filename}"

    when "people", "contact"
      contact = document.linkable
      raise ArgumentError, "WarehouseDocument #{document.id} has no linkable Contact - cannot determine path" unless contact&.is_a?(Contact)

      corporate_folder = config.path_for(:corporate) || "Corporate"
      people_folder = config.path_for(:people) || "People"
      "#{corporate_folder}/#{people_folder}/#{contact.id}/#{subfolder}/#{filename}"

    else
      # FAIL FAST: Unknown source_type is a bug (Jan 2026 FRC fix)
      raise ArgumentError, "Unknown source_type: #{source_type} - add explicit path handling"
    end
  end

  # Clean subfolder path - preserve case, remove problematic characters
  def clean_subfolder(path)
    return "Documents" if path.blank?
    path.split('/').map { |segment| clean_segment(segment) }.join('/')
  end

  # Clean filename - preserve case, remove problematic characters
  def clean_filename(filename)
    return "untitled" if filename.blank?
    ext = File.extname(filename)
    base = File.basename(filename, ext)
    "#{clean_segment(base)}#{ext}"
  end

  # Clean a single path segment - preserve case, remove only problematic chars
  def clean_segment(text)
    return "item" if text.blank?
    text.to_s
        .gsub(/[<>:"|?*\\]/, '')      # Remove Windows-invalid chars only
        .gsub(/\s+/, ' ')              # Normalize whitespace
        .strip
        .presence || "item"
  end

  # Legacy methods for backwards compatibility
  def slugify_path(path)
    clean_subfolder(path)
  end

  def slugify_filename(filename)
    clean_filename(filename)
  end

  def slugify(text)
    clean_segment(text)
  end
end
