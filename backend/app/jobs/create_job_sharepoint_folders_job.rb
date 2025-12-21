# RENAMED: CreateJobOnedriveFoldersJob → CreateJobSharepointFoldersJob
class CreateJobSharepointFoldersJob < ApplicationJob
  queue_as :default

  # Retry up to 3 times with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(job_id)
    job = Job.find(job_id)

    Rails.logger.info "[SharePoint] Creating folders for job #{job_id}: #{job.title}"

    # Update status to processing
    job.update_column(:sharepoint_folder_status, "processing")

    credential = OrganizationSharePointCredential.active_credential

    unless credential&.valid_credential?
      Rails.logger.warn "[SharePoint] No valid credential found, skipping folder creation for job #{job_id}"
      job.update_column(:sharepoint_folder_status, "failed")
      return
    end

    begin
      client = MicrosoftGraphClient.new(credential)

      # Validate root folder exists before attempting to create job folders
      folder_validation = client.validate_root_folder
      unless folder_validation[:valid]
        error_msg = "[SharePoint] Root folder validation failed for job #{job_id}: #{folder_validation[:error]}"
        Rails.logger.error error_msg

        # If folder not found, this is a critical configuration issue
        if folder_validation[:error_type] == "not_found"
          job.update_column(:sharepoint_folder_status, "folder_not_found")
          Rails.logger.error "[SharePoint] Root folder has been deleted or moved. Please reconfigure the root folder in Settings."
          return # Don't retry - this needs admin intervention
        elsif folder_validation[:error_type] == "not_configured"
          job.update_column(:sharepoint_folder_status, "not_configured")
          Rails.logger.warn "[SharePoint] No root folder configured. Please configure in Settings."
          return # Don't retry - needs configuration
        else
          job.update_column(:sharepoint_folder_status, "failed")
          raise StandardError, folder_validation[:error] # Retry for transient errors
        end
      end

      # Check if job folder already exists
      existing_folder = client.find_job_folder(job)

      if existing_folder
        Rails.logger.info "[SharePoint] Folder already exists for job #{job_id}"
        job.update_column(:sharepoint_folder_status, "completed")
        return
      end

      # Get default folder template
      template = FolderTemplate.where(is_system_default: true, is_active: true).first

      # Create folder structure for this job (with or without template)
      if template
        job_folder = client.create_job_folder_structure(job, template)
      else
        Rails.logger.warn "[SharePoint] No default folder template found, creating basic folder"
        # Create basic job folder without subfolders
        job_folder_name = "#{job.id.to_s.rjust(3, '0')} - #{job.title}"
        job_folder = client.create_folder(job_folder_name, parent_id: credential.root_folder_id)
      end

      Rails.logger.info "[SharePoint] Successfully created folders for job #{job_id}: #{job_folder['webUrl']}"
      job.update_column(:sharepoint_folder_status, "completed")

      # Mark credential as synced
      credential.mark_synced!

    rescue MicrosoftGraphClient::AuthenticationError => e
      Rails.logger.error "[SharePoint] Authentication failed for job #{job_id}: #{e.message}"
      job.update_column(:sharepoint_folder_status, "failed")
      raise # Re-raise to trigger retry
    rescue MicrosoftGraphClient::APIError => e
      Rails.logger.error "[SharePoint] API error for job #{job_id}: #{e.message}"
      job.update_column(:sharepoint_folder_status, "failed")
      raise # Re-raise to trigger retry
    rescue StandardError => e
      Rails.logger.error "[SharePoint] Failed to create folders for job #{job_id}: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      job.update_column(:sharepoint_folder_status, "failed")
      raise # Re-raise to trigger retry
    end
  end
end
