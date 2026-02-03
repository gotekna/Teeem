# frozen_string_literal: true

# ⚠️ DEPRECATED (Jan 2026) - DO NOT USE
# ════════════════════════════════════════════════════════════════════════════════
# This class was an SSoT VIOLATION - it bypassed StorageBlob, causing files to be
# stored at bucket root without proper blob architecture.
#
# ALL task uploads now go through SmTasksController#upload_standard_file which:
#   1. Creates StorageBlob (content-hash deduplication)
#   2. Stores files at Blobs/{hash}.ext (provider-agnostic)
#   3. Creates WarehouseDocument with storage_blob reference (SSoT)
#
# This file is kept only for reference. Remove after confirming no other code uses it.
# ════════════════════════════════════════════════════════════════════════════════
#
# Original purpose:
# TaskResponseUploader - Uploads task files to document storage (SharePoint, S3, etc.)
#
# SSoT: WarehouseProvider defines ALL folder paths via resolve_path():
#   - :task_responses scope → /Tasks/{TaskId}/Responses/{filename}
#   - :task_attachments scope → /Tasks/{TaskId}/Attachments/{filename}
#
# Job linkage is a DATA relationship (stored in document record), not a storage path decision.
class TaskResponseUploader
  class UploadError < StandardError; end

  attr_reader :job, :task, :tenant, :category

  # SSoT: Uses tenant for storage (Jan 2026 fix)
  def initialize(job: nil, task:, category: "response", tenant: nil)
    @job = job
    @task = task
    @category = category

    # SSoT: Derive tenant from task/job chain or explicit parameter
    @tenant = tenant ||
              task&.respond_to?(:tenant) && task.tenant ||
              job&.respond_to?(:tenant) && job.tenant ||
              ActsAsTenant.current_tenant

    unless @tenant
      Rails.logger.error "[TaskResponseUploader] No tenant found"
      raise ::TenantNotFoundError, "Tenant required for TaskResponseUploader"
    end
  end

  # Upload a file to the appropriate SharePoint folder
  # @param file [ActionDispatch::Http::UploadedFile] The file to upload
  # @return [Hash] { success: true, sharepoint_url: "...", file_id: "...", filename: "..." }
  def upload(file)
    config = WarehouseProvider.for_tenant(@tenant)

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

  # Create a WarehouseDocument record for the uploaded file
  #
  # @param upload_result [Hash] Result from #upload
  # @param file [ActionDispatch::Http::UploadedFile] Original file
  # @return [WarehouseDocument] The created document record
  def create_document_record(upload_result, file)
    # Get mime type from uploaded file (important for preview to work)
    mime_type = if file.respond_to?(:content_type)
                  file.content_type
                else
                  Marcel::MimeType.for(name: upload_result[:filename])
                end

    # SSoT: Resolve display_name from WarehouseFolder template (e.g., {{OriginalFileName}})
    resolved_display_name = resolve_display_name(upload_result[:filename])

    # Create or find StorageBlob for the file
    file_content = file.respond_to?(:read) ? file.read : file.to_s
    file.rewind if file.respond_to?(:rewind)

    blob = StorageBlob.find_or_create_for_content!(
      file_content,
      filename: upload_result[:filename],
      content_type: mime_type,
      storage_path: upload_result[:full_path]
    )

    # Determine documentable (task or job)
    documentable = task
    documentable = job if job.present?

    WarehouseDocument.create!(
      documentable: documentable,
      storage_blob: blob,
      source_type: "task",
      folder: folder_name,
      display_name: resolved_display_name,
      original_filename: upload_result[:filename],
      tenant_id: @tenant.id,
      metadata: {
        task_id: task.id,
        job_id: job&.id,
        upload_category: @category
      }
    )
  end

  private

  def document_provider
    # SSoT: Use tenant for provider (Jan 2026 fix)
    DocumentProviders.for_tenant(@tenant)
  end

  # Scope based on category - determines which WarehouseProvider path to use
  def storage_scope
    category == "response" ? :task_responses : :task_attachments
  end

  # Folder name for document record metadata (extracted from scope template)
  def folder_name
    category == "response" ? "Responses" : "Attachments"
  end

  # Normalize storage provider type to valid WarehouseDocument values
  # SSoT: Only 3 provider types - sharepoint, s3_compatible, local
  # WarehouseProvider.provider_type already normalizes legacy values
  def normalized_storage_provider
    WarehouseProvider.instance.provider_type
  end

  # Target folder path for task files
  # SSoT: WarehouseProvider.resolve_path() with scope defines ALL paths
  # No hardcoded folder names - reads from SCOPE_TEMPLATES
  def target_folder_path
    config = WarehouseProvider.for_organization(organization)
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

  # SSoT: Resolve display_name from WarehouseFolder template using SendNameResolver
  # WarehouseFolder.display_name can contain tokens like {{OriginalFileName}}, {{TaskName}}, {{Subject}}, etc.
  # Falls back to original filename if no template or WarehouseFolder not found
  def resolve_display_name(original_filename)
    # Find the WarehouseFolder for this storage scope (task_responses or task_attachments)
    # The folder_name method returns "Responses" or "Attachments"
    warehouse_folder = WarehouseFolder.find_by(
      warehouse_type: storage_scope.to_s,
      display_name: folder_name
    )

    # Fall back to original filename if no WarehouseFolder or no template
    return original_filename unless warehouse_folder&.display_name.present?

    template = warehouse_folder.display_name

    # If template has no tokens, use it as-is (it's a static name)
    return template unless template.include?("{")

    # Use SendNameResolver for consistent token handling
    # Build context with all available data
    resolver = SendNameResolver.new
    context = {
      original_filename: original_filename,
      task_id: task.id,
      task_number: task.task_number,
      task_name: task.name,
      document_date: Time.current
    }

    # Add job context if available
    if task.job.present?
      context[:job_code] = task.job.job_number
      context[:job_name] = task.job.name
    end

    # Use SendNameResolver's expand_template method
    resolved = resolver.send(:expand_template, template, context)

    # Fall back to original filename if resolution failed
    resolved.presence || original_filename
  end
end
