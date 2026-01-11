# Background job to create SharePoint folder structure for a construction/job
#
# This job is automatically enqueued when a new construction is created with
# `create_sharepoint_folders: true` parameter.
#
# The job:
# - Uses the organization-wide SharePoint credential
# - Creates a job-specific folder (e.g., "001 - Project Name")
# - Creates subfolders based on the folder template
# - Updates the construction's storage_folder_status
# - Is idempotent (won't recreate folders if they already exist)
#
# @param construction_id [Integer] The ID of the construction to create folders for
# @param template_id [Integer, nil] Optional folder template ID (uses default if nil)
class CreateJobFoldersJob < ApplicationJob
  queue_as :default

  # Retry with exponential backoff on API errors
  retry_on MicrosoftGraphClient::APIError, wait: :exponentially_longer, attempts: 3
  retry_on MicrosoftGraphClient::AuthenticationError, wait: 5.seconds, attempts: 2

  def perform(construction_id, template_id = nil)
    construction = Job.find(construction_id)

    # Mark as processing
    construction.update!(storage_folder_status: "processing")

    # Get organization SharePoint credential
    credential = MicrosoftCredential.sharepoint_credential

    unless credential&.valid_credential?
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "CreateJobFoldersJob failed: SharePoint not connected"
      return
    end

    # SSoT: Folder structure comes from EntityTab hierarchy (no longer uses FolderTemplate)
    # template_id parameter is deprecated and ignored

    begin
      client = MicrosoftGraphClient.new(credential)

      # Check if job folder already exists (idempotent)
      existing_folder = client.find_job_folder(construction)

      if existing_folder
        # Folders already exist, mark as completed
        construction.update!(storage_folder_status: "completed")
        Rails.logger.info "CreateJobFoldersJob: Folders already exist for Construction ##{construction_id}"
        return
      end

      # Create folder structure for this job (SSoT: uses EntityTab hierarchy)
      job_folder = client.create_job_folder_structure(construction)

      # Mark credential as synced
      credential.mark_synced!

      # Mark construction as completed
      construction.update!(storage_folder_status: "completed")

      Rails.logger.info "CreateJobFoldersJob succeeded: Created folders for Construction ##{construction_id}"

    rescue MicrosoftGraphClient::AuthenticationError => e
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "CreateJobFoldersJob authentication failed for Construction ##{construction_id}: #{e.message}"
      raise # Re-raise to trigger retry

    rescue MicrosoftGraphClient::APIError => e
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "CreateJobFoldersJob API error for Construction ##{construction_id}: #{e.message}"
      raise # Re-raise to trigger retry

    rescue StandardError => e
      construction.update!(storage_folder_status: "failed")
      Rails.logger.error "CreateJobFoldersJob failed for Construction ##{construction_id}: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      # Don't re-raise for unexpected errors - just mark as failed
    end
  end
end
