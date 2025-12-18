# frozen_string_literal: true

# Background job for syncing job documents from OneDrive to the database
# This populates the JobDocument table (data warehouse pattern) for instant lookups
#
# Usage:
#   JobDocumentSyncJob.perform_later(job_id)  # Sync a single job
#   JobDocumentSyncJob.perform_later          # Sync all jobs with OneDrive folders
#
class JobDocumentSyncJob < ApplicationJob
  queue_as :default

  # Retry on Microsoft Graph API errors with exponential backoff
  retry_on MicrosoftGraphClient::APIError, wait: :exponentially_longer, attempts: 3

  def perform(job_id = nil)
    credential = OrganizationSharePointCredential.active_credential
    unless credential
      Rails.logger.warn("[JobDocumentSync] No active OneDrive credential found")
      return { success: false, error: "No OneDrive credential" }
    end

    @client = MicrosoftGraphClient.new(credential)
    @drive_id = credential.drive_id
    @stats = { synced: 0, updated: 0, removed: 0, errors: [] }

    if job_id
      sync_single_job(Job.find(job_id))
    else
      sync_all_jobs
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
    # Only sync jobs that have OneDrive folders
    jobs_with_folders = Job.where(onedrive_folder_creation_status: "completed")
    Rails.logger.info("[JobDocumentSync] Syncing #{jobs_with_folders.count} jobs with OneDrive folders")

    jobs_with_folders.find_each do |job|
      sync_single_job(job)
    end
  end

  def sync_single_job(job)
    Rails.logger.info("[JobDocumentSync] Syncing job #{job.id}: #{job.title}")

    # Find the job's OneDrive folder
    job_folder = @client.find_job_folder(job)
    unless job_folder
      Rails.logger.warn("[JobDocumentSync] No OneDrive folder found for job #{job.id}")
      return
    end

    # Get all files recursively from the job folder
    files = list_all_files(job_folder["id"])
    Rails.logger.info("[JobDocumentSync] Found #{files.length} files in job #{job.id}")

    # Track which onedrive_item_ids we've seen (to detect deleted files)
    seen_item_ids = []

    files.each do |file|
      seen_item_ids << file[:id]
      sync_file_to_database(job, file)
    end

    # Mark missing files (deleted from OneDrive)
    removed_count = job.job_documents
      .where.not(onedrive_item_id: seen_item_ids)
      .update_all(sync_status: "missing")
    @stats[:removed] += removed_count
  rescue MicrosoftGraphClient::APIError => e
    @stats[:errors] << { job_id: job.id, error: e.message }
    Rails.logger.error("[JobDocumentSync] Failed to sync job #{job.id}: #{e.message}")
  end

  def sync_file_to_database(job, file)
    job_doc = JobDocument.find_or_initialize_by(onedrive_item_id: file[:id])
    is_new = job_doc.new_record?

    job_doc.assign_attributes(
      job: job,
      onedrive_drive_id: @drive_id,
      file_name: file[:name],
      file_size: file[:size],
      folder_path: file[:folder_path],
      web_url: file[:web_url],
      last_modified_at: file[:modified],
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

  # Recursively list all files from a folder (similar to JobDocumentMigrationService)
  def list_all_files(root_folder_id, max_depth: 5)
    files = []
    folders_to_process = [ [ root_folder_id, 0, "" ] ] # [folder_id, depth, path]

    while folders_to_process.any?
      current_id, depth, current_path = folders_to_process.shift

      begin
        url = "/drives/#{@drive_id}/items/#{current_id}/children?$select=id,name,size,webUrl,lastModifiedDateTime,file,folder&$top=200"
        result = @client.get(url)

        result["value"]&.each do |item|
          if item["file"]
            files << {
              id: item["id"],
              name: item["name"],
              size: item["size"],
              web_url: item["webUrl"],
              modified: item["lastModifiedDateTime"],
              folder_path: current_path
            }
          elsif item["folder"] && depth < max_depth
            folder_name = item["name"]
            new_path = current_path.empty? ? folder_name : "#{current_path}/#{folder_name}"
            folders_to_process << [ item["id"], depth + 1, new_path ]
          end
        end
      rescue MicrosoftGraphClient::APIError => e
        Rails.logger.warn("[JobDocumentSync] Failed to list folder #{current_id}: #{e.message}")
      end
    end

    files
  end
end
