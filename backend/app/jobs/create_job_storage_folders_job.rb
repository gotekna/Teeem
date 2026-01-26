# frozen_string_literal: true

# CreateJobStorageFoldersJob - Creates document storage folders for a job
#
# Uses the organization's configured document provider (SharePoint or S3-compatible).
# This job is provider-agnostic and works with any DocumentProviders implementation.
#
# Legacy name kept for backwards compatibility with enqueued jobs.
class CreateJobStorageFoldersJob < ApplicationJob
  include DocumentProviderAware

  queue_as :default

  # Retry up to 3 times with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(job_id)
    job = Job.find(job_id)
    # SSoT (Jan 2026): Derive organization from job's tenant
    tenant = job.tenant || ActsAsTenant.current_tenant
    organization = tenant&.organizations&.first

    unless organization
      Rails.logger.warn "[CreateJobStorageFolders] No organization found for job #{job_id}"
    end

    Rails.logger.info "[DocumentProvider] Creating folders for job #{job_id}: #{job.title}"

    # Update status to processing
    job.update_column(:storage_folder_status, "processing")

    begin
      # Setup the document provider for this organization
      setup_document_provider(organization)

      # Validate the root folder/bucket exists
      # Note: "not_configured" is OK - create_job_folder_structure will create the root folder
      validation = @document_provider.validate_root_folder
      unless validation[:valid]
        if validation[:error_type] == "not_configured"
          Rails.logger.info "[DocumentProvider] Root folder not configured - will be created automatically"
        else
          handle_validation_failure(job, validation)
          return
        end
      end

      # Check if job folder already exists
      existing_folder = @document_provider.find_job_folder(job)

      if existing_folder
        Rails.logger.info "[DocumentProvider] Folder already exists for job #{job_id}"
        # Store folder ID if not already stored (backfill existing jobs)
        folder_id = existing_folder["id"] || existing_folder[:id]
        job.update_columns(
          storage_folder_status: "completed",
          storage_folder_id: folder_id
        )
        return
      end

      # SSoT: Folder structure comes from EntityTab hierarchy (no longer uses FolderTemplate)
      # Create folder structure for this job
      job_folder = @document_provider.create_job_folder_structure(job)

      # Store the folder ID for stable lookups (SSoT: prevents data loss on folder rename)
      folder_id = job_folder["id"] || job_folder[:id]
      Rails.logger.info "[DocumentProvider] Successfully created folders for job #{job_id}: #{job_folder[:path] || job_folder['webUrl']} (ID: #{folder_id})"
      job.update_columns(
        storage_folder_status: "completed",
        storage_folder_id: folder_id
      )

      # Mark credential as synced (if applicable)
      @document_provider.credential.mark_synced! if @document_provider.credential.respond_to?(:mark_synced!)

    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.warn "[DocumentProvider] No provider configured for job #{job_id}: #{e.message}"
      job.update_column(:storage_folder_status, "not_configured")
      # Don't retry - needs configuration
    rescue DocumentProviders::AuthenticationError => e
      Rails.logger.error "[DocumentProvider] Authentication failed for job #{job_id}: #{e.message}"
      job.update_column(:storage_folder_status, "failed")
      raise # Re-raise to trigger retry
    rescue DocumentProviders::ProviderError, StandardError => e
      Rails.logger.error "[DocumentProvider] Failed to create folders for job #{job_id}: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      job.update_column(:storage_folder_status, "failed")
      raise # Re-raise to trigger retry
    end
  end

  private

  def handle_validation_failure(job, validation)
    error_msg = "[DocumentProvider] Root folder validation failed for job #{job.id}: #{validation[:error]}"
    Rails.logger.error error_msg

    case validation[:error_type]
    when "not_found"
      job.update_column(:storage_folder_status, "folder_not_found")
      Rails.logger.error "[DocumentProvider] Storage location has been deleted or moved. Please reconfigure in Settings."
      # Don't retry - needs admin intervention
    when "not_configured"
      job.update_column(:storage_folder_status, "not_configured")
      Rails.logger.warn "[DocumentProvider] No storage location configured. Please configure in Settings."
      # Don't retry - needs configuration
    when "permission_denied"
      job.update_column(:storage_folder_status, "failed")
      Rails.logger.error "[DocumentProvider] Permission denied. Please check credentials."
      # Don't retry - needs admin intervention
    else
      job.update_column(:storage_folder_status, "failed")
      raise StandardError, validation[:error] # Retry for transient errors
    end
  end
end
