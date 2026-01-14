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
      # SSoT: Use storage_item_id (provider-agnostic) instead of sharepoint_file_id
      storage_item_id: upload_result[:file_id],
      # Map provider type to valid storage_provider value
      # wasabi/s3/etc. → s3_compatible, sharepoint stays sharepoint
      storage_provider: normalized_storage_provider,
      storage_path: upload_result[:folder_path],
      # Use "other" document type for task uploads (task_response/task_attachment not in valid types)
      document_type: "other",
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

  # Normalize storage provider type to valid CorporateCompanyDocument values
  # Valid: ["sharepoint", "s3_compatible"]
  # Maps: wasabi/s3/minio/etc. → s3_compatible
  def normalized_storage_provider
    provider_type = StorageConfiguration.instance.provider_type
    case provider_type
    when "sharepoint"
      "sharepoint"
    when "wasabi", "s3", "minio", "aws_s3"
      "s3_compatible"
    else
      # Default to s3_compatible for unknown providers
      "s3_compatible"
    end
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
