# frozen_string_literal: true

module Engines
  # SharepointFetchEngine fetches existing files from SharePoint without modification.
  # Used for documents like "All Plans" that are already generated and just need to be retrieved.
  #
  class SharepointFetchEngine
    attr_reader :template

    def initialize(template)
      @template = template
    end

    def fetch(job: nil)
      # This engine fetches a pre-existing file from a job's SharePoint folder
      # rather than generating a new document

      raise ArgumentError, "Job is required for SharePoint fetch" unless job

      # Determine the folder path and file pattern
      folder_path = determine_folder_path(job)
      file_pattern = template.storage_path || template.name

      # SSoT: Get site_id/drive_id from WarehouseProvider, not template
      storage_config = WarehouseProvider.instance
      graph_client = MicrosoftAppGraphClient.new
      site_id = storage_config.site_id
      drive_id = storage_config.drive_id

      # Navigate to the job folder and find the file
      content = graph_client.get_file_by_path(
        site_id: site_id,
        drive_id: drive_id,
        path: "#{folder_path}/#{file_pattern}"
      )

      {
        pdf_content: content,
        filename: File.basename(file_pattern),
        generated_at: Time.current,
        source: :sharepoint
      }
    rescue MicrosoftAppGraphClient::ApiError => e
      raise UnifiedDocumentGenerator::TemplateError, "Failed to fetch document from SharePoint: #{e.message}"
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Microsoft credential decryption failed: #{e.message}")
      raise UnifiedDocumentGenerator::CredentialError, "Microsoft credentials expired. Please reconnect OneDrive."
    end

    private

    def determine_folder_path(job)
      # SSoT: Get jobs base path from WarehouseProvider
      storage_config = WarehouseProvider.instance
      jobs_base = storage_config.path_for(:jobs)
      job_folder_name = "#{job.job_number} - #{job.name}".truncate(100)
      "#{jobs_base}/#{job_folder_name}"
    end
  end
end
