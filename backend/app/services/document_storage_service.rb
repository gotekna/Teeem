# frozen_string_literal: true

# DocumentStorageService - THE ONE SSoT for uploading documents to storage
#
# Uses StorageConfiguration to determine paths and provider.
# Works with ANY document model that has a storage_path column.
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: StorageConfiguration determines WHERE files go             ║
# ║  This service is THE ONE way to upload documents                  ║
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
    folder_path = build_folder_path(scope, tokens)
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
  def preview_path(scope:, tokens:, filename:)
    folder_path = build_folder_path(scope, tokens)
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
  # Uses StorageConfiguration.path_for(scope) + template expansion
  def build_folder_path(scope, tokens)
    # Get base path from StorageConfiguration
    base_path = @storage_config.path_for(scope)

    # Get template for this scope
    template = @storage_config.template_for(scope)

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

  def error_result(message)
    { success: false, error: message }
  end
end
