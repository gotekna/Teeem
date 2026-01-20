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
    config = StorageConfiguration.for_organization(organization)

    # Check if task storage scope is enabled
    unless config.scope_enabled?(:task)
      raise UploadError, "Task storage is disabled."
    end

    # Check if SM-linked tasks should be excluded (configurable via UI)
    if config.exclude_sm_linked_tasks? && task.sm_schedule_master_id.present?
      raise UploadError, "Template tasks (linked to Schedule Master) store documents via Purchase Orders."
    end

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
      folder_path: folder_path,
      # SSoT: full_path is what gets stored in storage_path column
      # Must include filename for S3 download to work
      full_path: result[:path] || "#{folder_path}/#{filename}"
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
    # Get mime type from uploaded file (important for preview to work)
    mime_type = if file.respond_to?(:content_type)
                  file.content_type
                else
                  Marcel::MimeType.for(name: upload_result[:filename])
                end

    attrs = {
      file_name: upload_result[:filename],
      mime_type: mime_type,  # Required for PDF/image preview
      # SSoT: Use storage_item_id (provider-agnostic) instead of sharepoint_file_id
      storage_item_id: upload_result[:file_id],
      # Map provider type to valid storage_provider value
      # wasabi/s3/etc. → s3_compatible, sharepoint stays sharepoint
      storage_provider: normalized_storage_provider,
      # SSoT: storage_path must be FULL path including filename (not just folder)
      # S3 download uses this as the object key
      storage_path: upload_result[:full_path],
      # Use "other" document type for task uploads (task_response/task_attachment not in valid types)
      document_type: "other",
      folder: folder_name,
      source: "task_upload"
    }

    # SSoT: Always link to task (user uploaded from task context)
    # Also link to job if available for cross-referencing
    attrs[:sm_task_id] = task.id
    if job.present?
      attrs[:job_id] = job.id
      attrs[:documentable] = job  # Keep polymorphic for legacy compatibility
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
  # SSoT: Only 3 provider types - sharepoint, s3_compatible, local
  # StorageConfiguration.provider_type already normalizes legacy values
  def normalized_storage_provider
    StorageConfiguration.instance.provider_type
  end

  # Target folder path for task files
  # SSoT: StorageConfiguration.resolve_path() with scope defines ALL paths
  # No hardcoded folder names - reads from SCOPE_TEMPLATES
  def target_folder_path
    config = StorageConfiguration.for_organization(organization)
    # Pass all task + job substitutions for flexible path templates
    # Tasks belong to jobs, so include job context for paths like:
    # "Jobs/{{JobCode}}/Tasks/{{TaskNumber}} - {{TaskName}}"
    substitutions = {
      TaskId: task.id,
      TaskID: task.id,           # Alternative casing
      TaskNumber: task.task_number,
      TaskName: task.name,
      TaskStatus: task.status&.titleize || "Unknown"  # e.g., "Not Started", "Started", "Completed"
    }
    # Add job context if task has a job
    if task.job.present?
      substitutions[:JobCode] = task.job.job_number
      substitutions[:JobName] = task.job.name
    end
    config.resolve_path(storage_scope, substitutions)
  end

  def ensure_folder_exists(provider, folder_path)
    return if provider.folder_exists?(folder_path)

    # Create the folder - provider handles existing folders gracefully
    provider.create_folder(folder_path, create_parents: true)
  end
end
