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
      file_pattern = template.sharepoint_path || template.name

      # Fetch from SharePoint
      graph_client = MicrosoftAppGraphClient.new
      site_id = template.sharepoint_site_id
      drive_id = template.sharepoint_drive_id

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
      raise DocumentGenerator::TemplateError, "Failed to fetch document from SharePoint: #{e.message}"
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Microsoft credential decryption failed: #{e.message}")
      raise DocumentGenerator::CredentialError, "Microsoft credentials expired. Please reconnect OneDrive."
    end

    private

    def determine_folder_path(job)
      # Build path to job folder in SharePoint
      # Format: "Jobs/JOB-123 - Project Name" or similar
      job_folder_name = "#{job.job_number} - #{job.name}".truncate(100)
      "Jobs/#{job_folder_name}"
    end
  end
end
