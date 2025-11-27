class CreateJobOnedriveFoldersJob < ApplicationJob
  queue_as :default

  # Retry up to 3 times with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(job_id)
    job = Job.find(job_id)

    Rails.logger.info "[OneDrive] Creating folders for job #{job_id}: #{job.title}"

    # Update status to processing
    job.update_column(:onedrive_folder_creation_status, 'processing')

    credential = OrganizationOneDriveCredential.active_credential

    unless credential&.valid_credential?
      Rails.logger.warn "[OneDrive] No valid credential found, skipping folder creation for job #{job_id}"
      job.update_column(:onedrive_folder_creation_status, 'failed')
      return
    end

    begin
      client = MicrosoftGraphClient.new(credential)

      # Check if job folder already exists
      existing_folder = client.find_job_folder(job)

      if existing_folder
        Rails.logger.info "[OneDrive] Folder already exists for job #{job_id}"
        job.update_column(:onedrive_folder_creation_status, 'completed')
        return
      end

      # Get default folder template
      template = FolderTemplate.where(is_system_default: true, is_active: true).first

      # Create folder structure for this job (with or without template)
      if template
        job_folder = client.create_job_folder_structure(job, template)
      else
        Rails.logger.warn "[OneDrive] No default folder template found, creating basic folder"
        # Create basic job folder without subfolders
        job_folder_name = "#{job.id.to_s.rjust(3, '0')} - #{job.title}"
        job_folder = client.create_folder(job_folder_name, parent_id: credential.root_folder_id)
      end

      Rails.logger.info "[OneDrive] Successfully created folders for job #{job_id}: #{job_folder['webUrl']}"
      job.update_column(:onedrive_folder_creation_status, 'completed')

      # Mark credential as synced
      credential.mark_synced!

    rescue MicrosoftGraphClient::AuthenticationError => e
      Rails.logger.error "[OneDrive] Authentication failed for job #{job_id}: #{e.message}"
      job.update_column(:onedrive_folder_creation_status, 'failed')
      raise # Re-raise to trigger retry
    rescue MicrosoftGraphClient::APIError => e
      Rails.logger.error "[OneDrive] API error for job #{job_id}: #{e.message}"
      job.update_column(:onedrive_folder_creation_status, 'failed')
      raise # Re-raise to trigger retry
    rescue StandardError => e
      Rails.logger.error "[OneDrive] Failed to create folders for job #{job_id}: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      job.update_column(:onedrive_folder_creation_status, 'failed')
      raise # Re-raise to trigger retry
    end
  end
end
