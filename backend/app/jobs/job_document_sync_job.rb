# frozen_string_literal: true

# Background job for syncing job documents from storage to the database
# This populates the JobDocument table (data warehouse pattern) for instant lookups
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Syncs from Wasabi, SharePoint, or S3 based on StorageConfiguration║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   JobDocumentSyncJob.perform_later(job_id)  # Sync a single job
#   JobDocumentSyncJob.perform_later          # Sync all jobs with storage folders
#
class JobDocumentSyncJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  # Cache key for tracking last full sync time
  LAST_FULL_SYNC_CACHE_KEY = "job_document_sync:last_full_sync"
  # Minimum interval between full syncs (4 hours)
  FULL_SYNC_MIN_INTERVAL = 4.hours

  def perform(job_id = nil)
    # Smart skip for full syncs: Don't run if we ran recently
    # This prevents the job from blocking worker threads when data hasn't changed
    if job_id.nil?
      last_full_sync = Rails.cache.read(LAST_FULL_SYNC_CACHE_KEY)
      if last_full_sync && last_full_sync > FULL_SYNC_MIN_INTERVAL.ago
        Rails.logger.info("[JobDocumentSync] Skipping full sync - last ran #{last_full_sync.iso8601} (< #{FULL_SYNC_MIN_INTERVAL.inspect} ago)")
        return { skipped: true, last_sync: last_full_sync }
      end
    end

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.warn("[JobDocumentSync] No storage provider configured: #{e.message}")
      return { success: false, error: "No storage provider" }
    end

    @stats = { synced: 0, updated: 0, removed: 0, errors: [], provider: current_provider_type.to_s }

    if job_id
      sync_single_job(Job.find(job_id))
    else
      sync_all_jobs
      # Record full sync completion for smart skip logic
      Rails.cache.write(LAST_FULL_SYNC_CACHE_KEY, Time.current, expires_in: FULL_SYNC_MIN_INTERVAL * 2)
    end

    Rails.logger.info("[JobDocumentSync] Complete: #{@stats.inspect}")
    @stats
  rescue StandardError => e
    Rails.logger.error("[JobDocumentSync] Failed: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    raise
  end

  private

  def sync_all_jobs
    # Only sync jobs that have storage folders
    jobs_with_folders = Job.where(storage_folder_status: "completed")
    Rails.logger.info("[JobDocumentSync] Syncing #{jobs_with_folders.count} jobs with storage folders (provider: #{current_provider_type})")

    jobs_with_folders.find_each do |job|
      sync_single_job(job)
    end
  end

  def sync_single_job(job)
    Rails.logger.info("[JobDocumentSync] Syncing job #{job.id}: #{job.title}")

    # Build job folder path
    job_folder_path = build_job_folder_path(job)

    # Check if folder exists
    unless folder_exists_in_provider?(job_folder_path)
      Rails.logger.warn("[JobDocumentSync] No storage folder found for job #{job.id} at #{job_folder_path}")
      return
    end

    # Get all files recursively from the job folder
    files = list_all_files(job_folder_path)
    Rails.logger.info("[JobDocumentSync] Found #{files.length} files in job #{job.id}")

    # Track which storage_item_ids we've seen (to detect deleted files)
    seen_item_ids = []

    files.each do |file|
      seen_item_ids << file[:id]
      sync_file_to_database(job, file)
    end

    # Mark missing files (deleted from storage)
    removed_count = job.job_documents
      .where.not(storage_item_id: seen_item_ids)
      .update_all(sync_status: "missing")
    @stats[:removed] += removed_count
  rescue DocumentProviders::Error => e
    @stats[:errors] << { job_id: job.id, error: e.message }
    Rails.logger.error("[JobDocumentSync] Failed to sync job #{job.id}: #{e.message}")
  end

  def sync_file_to_database(job, file)
    job_doc = JobDocument.find_or_initialize_by(storage_item_id: file[:id])
    is_new = job_doc.new_record?

    # Detect if file was renamed in storage (name changed but ID is the same)
    # Preserve original_file_name for audit trail
    if !is_new && job_doc.file_name != file[:name]
      Rails.logger.info("[JobDocumentSync] Detected rename: #{job_doc.file_name} → #{file[:name]}")
      # Store original name if not already set
      job_doc.original_file_name ||= job_doc.file_name
    end

    # For new files, set original_file_name to current name
    if is_new
      job_doc.original_file_name = file[:name]
    end

    # SSoT: Get storage_provider value from StorageConfiguration
    doc_storage_provider = storage_config&.storage_provider_for_new_documents || "s3_compatible"

    job_doc.assign_attributes(
      job: job,
      storage_drive_id: file[:drive_id] || storage_config&.drive_id,
      storage_provider: doc_storage_provider,
      storage_path: file[:path] || file[:folder_path],
      file_name: file[:name],
      file_size: file[:size],
      folder_path: file[:folder_path],
      web_url: file[:web_url] || file[:path],
      thumbnail_url: file[:thumbnail_url],
      last_modified_at: file[:modified_at] || file[:modified],
      sync_status: "synced",
      last_synced_at: Time.current
    )

    # document_type detection happens automatically via before_save callback
    job_doc.save!

    if is_new
      @stats[:synced] += 1
    else
      @stats[:updated] += 1
    end
  rescue StandardError => e
    @stats[:errors] << { file: file[:name], error: e.message }
    Rails.logger.error("[JobDocumentSync] Failed to sync file #{file[:name]}: #{e.message}")
  end

  def build_job_folder_path(job)
    # SSoT: Use StorageConfiguration.job_path for consistent folder naming
    # Uses job_number (job_code), NOT job.id
    storage_config&.job_path(job.job_code) || begin
      # Fallback: Build manually (should not happen if StorageConfiguration is set up)
      base_folder = scope_folder_path(:job)
      job_folder_name = job.job_code
      "/#{base_folder}/#{job_folder_name}"
    end
  end

  def sanitize_folder_name(name)
    name.to_s.gsub(/[<>:"|?*\\]/, "_").strip
  end

  # List all files recursively from a folder
  def list_all_files(root_folder_path, max_depth: 5)
    files = []
    folders_to_process = [[root_folder_path, 0, ""]] # [folder_path, depth, relative_path]

    while folders_to_process.any?
      current_path, depth, relative_path = folders_to_process.shift

      begin
        items = list_folder_in_provider(current_path, recursive: false)

        items.each do |item|
          if item[:type] == :file
            files << {
              id: item[:id],
              name: item[:name],
              size: item[:size],
              path: item[:path],
              web_url: item[:path],
              modified_at: item[:modified_at],
              folder_path: relative_path,
              thumbnail_url: item[:thumbnail_url]
            }
          elsif item[:type] == :folder && depth < max_depth
            folder_name = item[:name]
            new_relative_path = relative_path.empty? ? folder_name : "#{relative_path}/#{folder_name}"
            folders_to_process << [item[:path], depth + 1, new_relative_path]
          end
        end
      rescue DocumentProviders::NotFoundError => e
        Rails.logger.warn("[JobDocumentSync] Folder not found: #{current_path}")
      rescue DocumentProviders::Error => e
        Rails.logger.warn("[JobDocumentSync] Failed to list folder #{current_path}: #{e.message}")
      end
    end

    files
  end
end
