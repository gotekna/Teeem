# frozen_string_literal: true

module Bpmn
  module Tasks
    # AttachSharepointFileTask - Attach an existing file from SharePoint to the workflow
    #
    # This task retrieves a file from the job's SharePoint folder and stores it
    # as a variable for use in signing packages or other downstream tasks.
    #
    # Config options:
    #   file_path: Path relative to job folder (e.g., "04 Plans/All Plans.pdf")
    #   file_name: Specific filename to find (e.g., "All Plans.pdf")
    #   folder_name: Folder to search in (e.g., "04 Plans")
    #   store_as_variable: Variable name to store the file content
    #
    # Subject: Job (required) - The job to get files from
    #
    class AttachSharepointFileTask < BaseTask
      def execute
        job = resolve_job
        raise "Job is required" unless job

        file_path = @config["file_path"]
        file_name = @config["file_name"]
        folder_name = @config["folder_name"]

        raise "Either file_path or file_name must be specified" if file_path.blank? && file_name.blank?

        log_info("Attaching SharePoint file for job #{job.id}")

        credential = OrganizationOneDriveCredential.active_credential
        raise "No active OneDrive credential" unless credential

        client = MicrosoftGraphClient.new(credential)

        # Find the job folder
        job_folder = client.find_job_folder(job)
        raise "Job folder not found in SharePoint" unless job_folder

        # Find the file
        file_content, file_info = find_and_download_file(client, job_folder["id"], file_path, file_name, folder_name)

        raise "File not found: #{file_path || file_name}" unless file_content

        log_info("Found file: #{file_info[:name]} (#{file_content.bytesize} bytes)")

        # Store the file content in a variable for downstream tasks
        if @config["store_as_variable"]
          set_variable(@config["store_as_variable"], {
            file_name: file_info[:name],
            file_id: file_info[:id],
            web_url: file_info[:web_url],
            content_base64: Base64.strict_encode64(file_content),
            mime_type: file_info[:mime_type] || "application/pdf",
            size: file_content.bytesize
          })
        end

        {
          success: true,
          file_name: file_info[:name],
          file_id: file_info[:id],
          web_url: file_info[:web_url],
          size: file_content.bytesize
        }
      end

      private

      def resolve_job
        return @subject if @subject.is_a?(Job)
        @subject.job if @subject.respond_to?(:job)
      end

      def find_and_download_file(client, job_folder_id, file_path, file_name, folder_name)
        if file_path.present?
          # Navigate path and download
          return download_by_path(client, job_folder_id, file_path)
        end

        # Find in specific folder or job folder
        folder_id = job_folder_id

        if folder_name.present?
          # Navigate to the specified folder
          response = client.list_folder_items(job_folder_id)
          items = response["value"] || []
          folder = items.find { |item| item["name"] == folder_name && item["folder"].present? }
          raise "Folder '#{folder_name}' not found" unless folder
          folder_id = folder["id"]
        end

        # Find the file by name
        response = client.list_folder_items(folder_id)
        items = response["value"] || []
        file = items.find { |item| item["name"] == file_name && item["file"].present? }

        return nil unless file

        content = client.download_file(file["id"])
        file_info = {
          name: file["name"],
          id: file["id"],
          web_url: file["webUrl"],
          mime_type: file.dig("file", "mimeType")
        }

        [content, file_info]
      end

      def download_by_path(client, folder_id, path)
        parts = path.split("/")
        file_name = parts.pop
        current_folder_id = folder_id

        # Navigate through folders
        parts.each do |folder_name|
          response = client.list_folder_items(current_folder_id)
          items = response["value"] || []
          folder = items.find { |item| item["name"] == folder_name && item["folder"].present? }
          return nil unless folder
          current_folder_id = folder["id"]
        end

        # Find and download the file
        response = client.list_folder_items(current_folder_id)
        items = response["value"] || []
        file = items.find { |item| item["name"] == file_name && item["file"].present? }

        return nil unless file

        content = client.download_file(file["id"])
        file_info = {
          name: file["name"],
          id: file["id"],
          web_url: file["webUrl"],
          mime_type: file.dig("file", "mimeType")
        }

        [content, file_info]
      end
    end
  end
end
