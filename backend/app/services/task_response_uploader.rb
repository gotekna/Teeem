# frozen_string_literal: true

# TaskResponseUploader
# Uploads task files to document storage (SharePoint, S3, etc.)
#
# SSoT: StorageConfiguration defines ALL folder paths via resolve_path():
#   - :task_responses scope → /Tasks/{TaskId}/Responses/{filename}
#   - :task_attachments scope → /Tasks/{TaskId}/Attachments/{filename}
#
# Job linkage is a DATA relationship (stored in document record), not a storage path decision.
class TaskResponseUploader
  class UploadError < StandardError; end

  attr_reader :job, :task, :organization, :category

  def initialize(job: nil, task:, category: "response", organization: nil)
    @job = job
    @task = task
    @category = category
    # Get organization - use Organization.first for single-tenant app
    # Job doesn't have .organization association, so we use the global org
    @organization = organization || Organization.first
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
  rescue DocumentProviders::NotConnectedError => e
    Rails.logger.error("[TaskResponseUploader] Storage not connected: #{e.message}")
    raise UploadError, "Document storage is not connected. Please check system settings."
  rescue DocumentProviders::NotFoundError => e
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
      sharepoint_download_url: upload_result[:sharepoint_url],
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

  # Scope based on category - determines which StorageConfiguration path to use
  def storage_scope
    category == "response" ? :task_responses : :task_attachments
  end

  # Folder name for document record metadata (extracted from scope template)
  def folder_name
    category == "response" ? "Responses" : "Attachments"
  end

  # Document type based on category
  def document_type
    category == "response" ? "task_response" : "task_attachment"
  end

  # Target folder path for task files
  # SSoT: StorageConfiguration.resolve_path() with scope defines ALL paths
  # No hardcoded folder names - reads from SCOPE_TEMPLATES
  def target_folder_path
    config = StorageConfiguration.for_organization(organization)
    config.resolve_path(storage_scope, { TaskId: task.id })
  end

  def ensure_folder_exists(provider, folder_path)
    return if provider.folder_exists?(folder_path)

    # Create the folder - provider handles existing folders gracefully
    provider.create_folder(folder_path, create_parents: true)
  end
end
