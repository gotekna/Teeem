# frozen_string_literal: true

# DocumentStorageService - THE ONE SSoT for document storage operations
#
# Uses StorageConfiguration to determine paths and provider.
# Works with ANY document model that has a storage_path column.
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: StorageConfiguration determines WHERE files go             ║
# ║  This service is THE ONE way to upload AND download documents     ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   service = DocumentStorageService.new
#
#   # Upload a file for a Job document
#   service.upload(
#     scope: :job,
#     record: job_document,
#     file: uploaded_file,
#     tokens: { JobCode: "J-001", TabName: "Plans" }
#   )
#   # => { success: true, path: "Jobs/J-001/Plans/drawing.pdf" }
#
#   # Upload a file for a Corporate document
#   service.upload(
#     scope: :corporate,
#     record: corporate_document,
#     file: uploaded_file,
#     tokens: { CompanyGroup: "Promise", CompanyCode: "TEE", TabName: "ASIC" }
#   )
#   # => { success: true, path: "Corporate/Promise/TEE/ASIC/certificate.pdf" }
#
#   # Download a document (works with ANY document model)
#   result = service.download(corporate_document)
#   # => { success: true, content: binary_data, content_type: "...", filename: "..." }
#
#   # Generate presigned download URL
#   result = service.download_url(job_document)
#   # => { success: true, url: "https://..." }
#
# Supported scopes (from StorageConfiguration):
#   :job, :corporate, :people, :contact, :task, :email, :email_attachments, etc.
#
class DocumentStorageService
  attr_reader :storage_config, :provider

  def initialize
    @storage_config = StorageConfiguration.instance
    @provider = get_storage_provider
  end

  # Upload a file and update the record's storage_path
  #
  # @param scope [Symbol] The storage scope (:job, :corporate, :contact, etc.)
  # @param record [ActiveRecord::Base] The document record to update
  # @param file [ActionDispatch::Http::UploadedFile, File, String] The file or content
  # @param tokens [Hash] Token values for path template (e.g., { JobCode: "J-001" })
  # @param filename [String] Optional filename override
  # @param content_type [String] Optional content type override
  # @return [Hash] { success: true/false, path: "...", error: "..." }
  def upload(scope:, record:, file:, tokens: {}, filename: nil, content_type: nil)
    unless @provider
      return error_result("No storage provider configured. Check StorageConfiguration.")
    end

    # Get file content and metadata
    file_content, file_name, mime_type = extract_file_data(file, filename, content_type)

    unless file_content.present?
      return error_result("No file content provided")
    end

    # Build the storage path using StorageConfiguration
    # SSoT: Pass record so we can use its EntityTab.storage_folder_path template
    folder_path = build_folder_path(scope, tokens, record: record)
    full_path = "#{folder_path}/#{sanitize_filename(file_name)}"

    Rails.logger.info "[DocumentStorage] Uploading to #{full_path} (#{file_content.bytesize} bytes)"

    # Upload to storage provider
    result = @provider.upload_file(folder_path, file_content, file_name, content_type: mime_type)

    # Update the record with storage_path
    if record.respond_to?(:storage_path=)
      record.update!(
        storage_path: result[:path],
        storage_file_id: result[:id]
      )
    end

    Rails.logger.info "[DocumentStorage] SUCCESS: #{result[:path]}"

    {
      success: true,
      path: result[:path],
      file_id: result[:id],
      size: file_content.bytesize
    }
  rescue StandardError => e
    Rails.logger.error "[DocumentStorage] Error: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    error_result(e.message)
  end

  # Upload multiple files for a record
  def upload_multiple(scope:, record:, files:, tokens: {})
    results = []
    files.each do |file|
      result = upload(scope: scope, record: record, file: file, tokens: tokens)
      results << result
    end
    {
      success: results.all? { |r| r[:success] },
      results: results
    }
  end

  # Build a storage path without uploading (for preview/validation)
  # SSoT: Pass record to use its EntityTab.storage_folder_path template
  def preview_path(scope:, tokens:, filename:, record: nil)
    folder_path = build_folder_path(scope, tokens, record: record)
    "#{folder_path}/#{sanitize_filename(filename)}"
  end

  # Check if storage is available
  def available?
    @provider.present? && @storage_config.connected?
  end

  # Get storage stats
  def stats
    {
      provider: @storage_config.provider_type,
      connected: @storage_config.connected?,
      root_path: @storage_config.root_path,
      available_scopes: StorageConfiguration::SCOPE_FOLDERS.keys
    }
  end

  # ============================================================================
  # DOWNLOAD METHODS - SSoT for retrieving documents from any storage provider
  # ============================================================================

  # Download file content from storage
  # Works with ANY document model (JobDocument, CorporateCompanyDocument, etc.)
  #
  # @param record [ActiveRecord::Base] Document with storage_path/storage_provider or sharepoint_file_id
  # @return [Hash] { success: true, content: binary, content_type: "...", filename: "..." }
  #                or { success: false, error: "...", status: :symbol }
  def download(record)
    return error_result("No record provided", status: :bad_request) unless record

    # Priority 1: S3-compatible (Wasabi)
    if record.respond_to?(:storage_provider) && record.storage_provider == "s3_compatible" && record.storage_path.present?
      download_from_s3(record)
    # Priority 2: SharePoint
    elsif has_sharepoint_id?(record)
      download_from_sharepoint(record)
    # Priority 3: ActiveStorage
    elsif record.respond_to?(:file) && record.file.attached?
      download_from_active_storage(record)
    else
      error_result("No file available - document has no storage path, SharePoint ID, or uploaded file", status: :not_found)
    end
  end

  # Generate presigned download URL (no binary transfer)
  # For S3: returns presigned URL with expiry
  # For SharePoint: returns web_url or download URL
  #
  # @param record [ActiveRecord::Base] Document model
  # @param expires_in [Integer] URL expiry in seconds (default: 3600)
  # @return [Hash] { success: true, url: "..." }
  def download_url(record, expires_in: 3600)
    return error_result("No record provided", status: :bad_request) unless record

    # Priority 1: S3-compatible (Wasabi)
    if record.respond_to?(:storage_provider) && record.storage_provider == "s3_compatible" && record.storage_path.present?
      # Use build_s3_key to handle legacy records where storage_path is just folder
      s3_key = build_s3_key(record)
      begin
        provider = s3_provider
        return error_result("S3 storage not configured", status: :service_unavailable) unless provider

        url = provider.download_url(s3_key, expires_in: expires_in)
        { success: true, url: url }
      rescue DocumentProviders::NotFoundError
        error_result("File not found in S3 storage: #{s3_key}", status: :not_found)
      rescue DocumentProviders::NotConnectedError
        error_result("S3 storage not configured", status: :service_unavailable)
      rescue => e
        Rails.logger.error "[DocumentStorage] S3 URL error: #{e.message}"
        error_result("Failed to generate S3 URL: #{e.message}", status: :internal_server_error)
      end
    # Priority 2: SharePoint
    elsif has_sharepoint_id?(record)
      # SharePoint web_url is already a usable URL
      url = record.respond_to?(:web_url) ? record.web_url : record.file_url
      if url.present?
        { success: true, url: url }
      else
        error_result("No SharePoint URL available", status: :not_found)
      end
    else
      error_result("No storage URL available", status: :not_found)
    end
  end

  private

  def get_storage_provider
    case @storage_config.provider_type
    when "wasabi", "s3"
      credential = S3CompatibleCredential.active.first
      return nil unless credential
      DocumentProviders::S3Compatible.new(credential)
    when "sharepoint"
      credential = MicrosoftCredential.sharepoint_credential
      return nil unless credential
      DocumentProviders::SharePoint.new(credential)
    else
      Rails.logger.error "[DocumentStorage] Unknown provider: #{@storage_config.provider_type}"
      nil
    end
  rescue => e
    Rails.logger.error "[DocumentStorage] Failed to get provider: #{e.message}"
    nil
  end

  # Build folder path from scope and tokens
  # SSoT Priority:
  # 1. Record's storage_folder_template (from EntityTab.storage_folder_path - database)
  # 2. StorageConfiguration.template_for(scope) (fallback)
  def build_folder_path(scope, tokens, record: nil)
    # Get base path from StorageConfiguration
    base_path = @storage_config.path_for(scope)

    # SSoT: Try to get template from record's EntityTab first (database-stored)
    # Falls back to StorageConfiguration constant if not available
    template = if record&.respond_to?(:storage_folder_template) && record.storage_folder_template.present?
      record.storage_folder_template
    else
      @storage_config.template_for(scope)
    end

    # Expand template with tokens
    expanded = expand_template(template, tokens)

    # Combine: base_path + expanded template
    path = [base_path, expanded].compact.reject(&:blank?).join("/")

    # Clean up path (remove double slashes, leading/trailing slashes)
    path.gsub(%r{/+}, "/").sub(%r{^/}, "").sub(%r{/$}, "")
  end

  # Expand template tokens like {{JobCode}} with actual values
  def expand_template(template, tokens)
    return "" if template.blank?

    result = template.dup
    tokens.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s)
    end

    # Remove any unexpanded tokens
    result.gsub(/\{\{[^}]+\}\}/, "").gsub(%r{/+}, "/").sub(%r{/$}, "")
  end

  # Extract file content, name, and mime type from various input formats
  def extract_file_data(file, filename_override, content_type_override)
    case file
    when ActionDispatch::Http::UploadedFile
      content = file.read
      file.rewind
      name = filename_override || file.original_filename
      mime = content_type_override || file.content_type || detect_content_type(name, content)
      [content, name, mime]
    when File
      content = file.read
      name = filename_override || File.basename(file.path)
      mime = content_type_override || detect_content_type(name, content)
      [content, name, mime]
    when String
      # Assume it's raw content
      name = filename_override || "document"
      mime = content_type_override || "application/octet-stream"
      [file, name, mime]
    else
      [nil, nil, nil]
    end
  end

  def detect_content_type(filename, content = nil)
    return "application/octet-stream" unless filename

    case File.extname(filename).downcase
    when ".pdf" then "application/pdf"
    when ".doc" then "application/msword"
    when ".docx" then "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    when ".xls" then "application/vnd.ms-excel"
    when ".xlsx" then "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when ".png" then "image/png"
    when ".jpg", ".jpeg" then "image/jpeg"
    when ".gif" then "image/gif"
    when ".txt" then "text/plain"
    when ".csv" then "text/csv"
    when ".eml" then "message/rfc822"
    when ".zip" then "application/zip"
    else "application/octet-stream"
    end
  end

  def sanitize_filename(filename)
    # Remove path components, keep only filename
    name = File.basename(filename.to_s)
    # Replace problematic characters
    name.gsub(/[<>:"\/\\|?*]/, "_")
  end

  def error_result(message, status: nil)
    result = { success: false, error: message }
    result[:status] = status if status
    result
  end

  # ============================================================================
  # DOWNLOAD HELPERS (Private)
  # ============================================================================

  def download_from_s3(record)
    s3_key = build_s3_key(record)
    provider = s3_provider
    return error_result("S3 storage not configured", status: :service_unavailable) unless provider

    content = provider.download_file(s3_key)
    {
      success: true,
      content: content,
      content_type: detect_content_type(record.file_name),
      filename: record.file_name
    }
  rescue DocumentProviders::NotFoundError
    error_result("File not found in S3 storage: #{s3_key}", status: :not_found)
  rescue DocumentProviders::NotConnectedError
    error_result("S3 storage not configured", status: :service_unavailable)
  rescue => e
    Rails.logger.error "[DocumentStorage] S3 download error for #{record.class.name}##{record.id}: #{e.message}"
    error_result("Failed to download file from S3: #{e.message}", status: :internal_server_error)
  end

  def download_from_sharepoint(record)
    credential = MicrosoftCredential.sharepoint_credential
    return error_result("SharePoint not configured", status: :service_unavailable) unless credential

    client = MicrosoftGraphClient.new(credential)
    # SSoT: Use storage_reference fallback pattern (storage_item_id || sharepoint_file_id)
    file_id = record.respond_to?(:storage_reference) ? record.storage_reference : nil
    file_id ||= record.respond_to?(:sharepoint_file_id) ? record.sharepoint_file_id : nil
    file_id ||= record.respond_to?(:sharepoint_item_id) ? record.sharepoint_item_id : nil
    return error_result("No SharePoint file ID", status: :not_found) unless file_id

    content = client.download_file(file_id)
    {
      success: true,
      content: content,
      content_type: detect_content_type(record.file_name),
      filename: record.file_name
    }
  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error "[DocumentStorage] SharePoint download error for #{record.class.name}##{record.id}: #{e.message}"
    error_result("SharePoint download failed: #{e.message}", status: :bad_gateway)
  rescue => e
    Rails.logger.error "[DocumentStorage] SharePoint error: #{e.message}"
    error_result("SharePoint error: #{e.message}", status: :internal_server_error)
  end

  def download_from_active_storage(record)
    {
      success: true,
      content: record.file.download,
      content_type: record.file.content_type || detect_content_type(record.file_name),
      filename: record.file_name || record.file.filename.to_s
    }
  rescue ActiveStorage::FileNotFoundError
    error_result("File not found in storage", status: :not_found)
  rescue => e
    Rails.logger.error "[DocumentStorage] ActiveStorage error for #{record.class.name}##{record.id}: #{e.message}"
    error_result("Failed to download file: #{e.message}", status: :internal_server_error)
  end

  def has_sharepoint_id?(record)
    # SSoT: Check storage_reference first (storage_item_id || sharepoint_file_id fallback)
    (record.respond_to?(:storage_reference) && record.storage_reference.present?) ||
      (record.respond_to?(:sharepoint_file_id) && record.sharepoint_file_id.present?) ||
      (record.respond_to?(:sharepoint_item_id) && record.sharepoint_item_id.present?)
  end

  # Build the S3 key from storage_path + file_name
  # Handles legacy records where storage_path is just the folder (missing filename)
  def build_s3_key(record)
    path = record.storage_path.to_s.sub(%r{^/}, "")
    filename = record.file_name.to_s

    # If storage_path already ends with a file extension, use it as-is
    # Common extensions: .pdf, .doc, .docx, .xls, .xlsx, .png, .jpg, etc.
    if path.match?(/\.\w{2,5}$/)
      path
    elsif filename.present?
      # Check if path already ends with the filename (even without extension)
      # This handles cases like: path="Tasks/123/ASIC Registration", filename="ASIC Registration"
      path_basename = File.basename(path)
      if path_basename == filename || path_basename == File.basename(filename, ".*")
        # Path already includes filename - use as-is
        path
      else
        # Storage path is just folder - append filename
        "#{path.chomp('/')}/#{filename}"
      end
    else
      # No filename available, use path as-is (will likely fail)
      path
    end
  end

  def s3_provider
    @s3_provider ||= begin
      credential = S3CompatibleCredential.active.connected.first
      DocumentProviders::S3Compatible.new(credential) if credential
    end
  end
end
