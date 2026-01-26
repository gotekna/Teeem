# frozen_string_literal: true

module Bpmn
  module Tasks
    # AttachStorageFileTask - Attach an existing file from storage to the workflow
    #
    # This task retrieves a file from the job's storage folder and stores it
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
      include DocumentProviderAware

      def execute
        job = resolve_job
        raise "Job is required" unless job

        file_path = @config["file_path"]
        file_name = @config["file_name"]
        folder_name = @config["folder_name"]

        raise "Either file_path or file_name must be specified" if file_path.blank? && file_name.blank?

        log_info("Attaching storage file for job #{job.id}")

        # Setup provider-agnostic storage
        setup_default_provider!

        # Find the job folder
        job_folder_path = job.storage_folder_path
        raise "Job folder not found in storage" unless job_folder_path

        # Find the file
        file_content, file_info = find_and_download_file(job_folder_path, file_path, file_name, folder_name)

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

      def find_and_download_file(job_folder_path, file_path, file_name, folder_name)
        if file_path.present?
          # Navigate path and download
          return download_by_path(job_folder_path, file_path)
        end

        # Find in specific folder or job folder
        current_path = job_folder_path

        if folder_name.present?
          current_path = "#{job_folder_path}/#{folder_name}"
          raise "Folder '#{folder_name}' not found" unless folder_exists_in_provider?(current_path)
        end

        # Find the file by name in the folder
        items = list_folder_in_provider(current_path)
        file = items.find { |item| item[:name] == file_name && !item[:is_folder] }

        return nil unless file

        # Download the file content
        result = DocumentStorageService.new.download_file(file[:path] || file[:id])
        return nil unless result[:success]

        file_info = {
          name: file[:name],
          id: file[:id],
          web_url: file[:web_url] || file[:url],
          mime_type: "application/pdf"
        }

        [result[:content], file_info]
      end

      def download_by_path(job_folder_path, path)
        full_path = "#{job_folder_path}/#{path}"

        # List the parent folder to find the file
        parent_path = File.dirname(full_path)
        file_name = File.basename(full_path)

        return nil unless folder_exists_in_provider?(parent_path)

        items = list_folder_in_provider(parent_path)
        file = items.find { |item| item[:name] == file_name && !item[:is_folder] }

        return nil unless file

        # Download the file content
        result = DocumentStorageService.new.download_file(file[:path] || file[:id])
        return nil unless result[:success]

        file_info = {
          name: file[:name],
          id: file[:id],
          web_url: file[:web_url] || file[:url],
          mime_type: "application/pdf"
        }

        [result[:content], file_info]
      end
    end
  end
end
