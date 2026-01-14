# frozen_string_literal: true

# TaskResponseUploader
# Uploads task files to SharePoint
#
# For tasks WITH a job:
#   - "response" → /Jobs/{JobCode}/Responses/{filename}
#   - "info" → /Jobs/{JobCode}/Task Attachments/{filename}
#
# For tasks WITHOUT a job (standalone tasks):
#   - All files → /Tasks/Task-{id}/{Category}/{filename}
#
# SSoT: Paths come from StorageConfiguration.job_path() and StorageConfiguration.task_path()
class TaskResponseUploader
  class UploadError < StandardError; end

  attr_reader :job, :task, :organization, :category

  def initialize(job: nil, task:, category: "response", organization: nil)
    @job = job
    @task = task
    @category = category
    # SmTask doesn't have .organization - get it through the job association
    @organization = organization || job&.organization || task&.job&.organization || Organization.current
  end

  # Upload a file to the appropriate SharePoint folder
  # @param file [ActionDispatch::Http::UploadedFile] The file to upload
  # @return [Hash] { success: true, sharepoint_url: "...", file_id: "...", filename: "..." }
  def upload(file)
    provider = document_provider
    folder_path = target_folder_path

    # Ensure the folder exists
    ensure_folder_exists(provider, folder_path)

    # Read file content
    content = file.respond_to?(:read) ? file.read : file
    filename = file.respond_to?(:original_filename) ? file.original_filename : File.basename(file.to_s)

    # Upload to SharePoint
    result = provider.upload_file(folder_path, content, filename)

    {
      success: true,
      sharepoint_url: result[:web_url],
      file_id: result[:id],
      filename: filename,
      folder_path: folder_path
    }
  rescue DocumentProviders::Base::NotConnectedError => e
    Rails.logger.error("[TaskResponseUploader] SharePoint not connected: #{e.message}")
    raise UploadError, "SharePoint is not connected. Please check system settings."
  rescue DocumentProviders::Base::NotFoundError => e
    Rails.logger.error("[TaskResponseUploader] Folder not found: #{e.message}")
    raise UploadError, "Could not find or create the #{folder_name} folder."
  rescue StandardError => e
    Rails.logger.error("[TaskResponseUploader] Upload failed: #{e.message}")
    raise UploadError, "Failed to upload file: #{e.message}"
  end

  # Create a CorporateCompanyDocument record for the uploaded file
  # @param upload_result [Hash] Result from #upload
  # @param file [ActionDispatch::Http::UploadedFile] Original file
  # @return [CorporateCompanyDocument] The created document record
  def create_document_record(upload_result, file)
    attrs = {
      file_name: upload_result[:filename],
      display_name: upload_result[:filename],
      sharepoint_url: upload_result[:sharepoint_url],
      sharepoint_file_id: upload_result[:file_id],
      document_type: document_type,
      folder: folder_name,
      source: "task_upload"
    }

    # Link to job if available, otherwise link to task
    if job.present?
      attrs[:documentable] = job
    else
      attrs[:sm_task_id] = task.id
    end

    CorporateCompanyDocument.create!(attrs)
  end

  private

  def document_provider
    # SSoT: Use generic provider factory which respects StorageConfiguration
    DocumentProviders.for_organization(organization)
  end

  # Folder name based on category
  def folder_name
    category == "response" ? "Responses" : "Task Attachments"
  end

  # Document type based on category
  def document_type
    category == "response" ? "task_response" : "task_attachment"
  end

  # Target folder path based on whether task has a job
  # SSoT: Uses StorageConfiguration for path resolution
  def target_folder_path
    config = StorageConfiguration.for_organization(organization)
    if job.present?
      # Task has a job - use job folder structure
      config.job_path(job.code, folder_name)
    else
      # Standalone task - use task folder structure
      config.task_path(task.id, folder_name)
    end
  end

  def ensure_folder_exists(provider, folder_path)
    return if provider.folder_exists?(folder_path)

    # Create the folder
    provider.create_folder(folder_path, create_parents: true)
  rescue DocumentProviders::Base::AlreadyExistsError
    # Folder already exists, that's fine
  end
end
