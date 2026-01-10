# frozen_string_literal: true

# TaskResponseUploader
# Uploads task response files to a dedicated SharePoint subfolder
# Path: /Shared Documents/TEEEM Jobs/{JobCode}/Responses/{filename}
class TaskResponseUploader
  class UploadError < StandardError; end

  attr_reader :job, :task, :organization

  def initialize(job:, task:, organization: nil)
    @job = job
    @task = task
    @organization = organization || job&.organization || Organization.current
  end

  # Upload a file to the Responses folder
  # @param file [ActionDispatch::Http::UploadedFile] The file to upload
  # @return [Hash] { success: true, sharepoint_url: "...", file_id: "...", filename: "..." }
  def upload(file)
    raise UploadError, "Job is required for response file uploads" unless job.present?

    provider = document_provider
    folder_path = response_folder_path

    # Ensure the Responses folder exists
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
    raise UploadError, "Could not find or create the Responses folder."
  rescue StandardError => e
    Rails.logger.error("[TaskResponseUploader] Upload failed: #{e.message}")
    raise UploadError, "Failed to upload file: #{e.message}"
  end

  # Create a CorporateCompanyDocument record for the uploaded file
  # @param upload_result [Hash] Result from #upload
  # @param file [ActionDispatch::Http::UploadedFile] Original file
  # @return [CorporateCompanyDocument] The created document record
  def create_document_record(upload_result, file)
    CorporateCompanyDocument.create!(
      file_name: upload_result[:filename],
      display_name: upload_result[:filename],
      sharepoint_url: upload_result[:sharepoint_url],
      sharepoint_file_id: upload_result[:file_id],
      document_type: "task_response",
      folder: "Responses",
      source: "task_upload",
      documentable: job
    )
  end

  private

  def document_provider
    DocumentProviders::SharePoint.for_organization(organization)
  end

  def response_folder_path
    # Use SSoT: CorporateCompanySetting.job_path for consistent path resolution
    CorporateCompanySetting.job_path(job.code, "Responses")
  end

  def ensure_folder_exists(provider, folder_path)
    return if provider.folder_exists?(folder_path)

    # Create the Responses folder under the job folder
    provider.create_folder(folder_path, create_parents: true)
  rescue DocumentProviders::Base::AlreadyExistsError
    # Folder already exists, that's fine
  end
end
