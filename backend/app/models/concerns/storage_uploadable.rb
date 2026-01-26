# frozen_string_literal: true

# StorageUploadable - Common upload pattern for services
# SSoT: Wraps DocumentProviderAware with convenient upload helpers
#
# Usage:
#   class MyReportService
#     include StorageUploadable
#
#     def generate
#       content = build_pdf
#       result = upload_to_storage_path(
#         "/Reports/#{company}/#{year}",
#         content,
#         "report.pdf",
#         content_type: "application/pdf"
#       )
#       # result = { success: true, path: "...", url: "...", id: "..." }
#     end
#   end
#
module StorageUploadable
  extend ActiveSupport::Concern

  included do
    include DocumentProviderAware
  end

  # Upload content to a storage path, creating folders as needed
  # Returns: { success: true, path:, url:, id: } or { success: false, error: }
  def upload_to_storage_path(folder_path, content, filename, content_type: nil)
    # Setup provider
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.warn("[#{self.class.name}] Storage not connected: #{e.message}")
      return { success: false, error: "Storage not connected: #{e.message}" }
    end

    # Ensure folder exists
    get_or_create_folder_path(folder_path)

    # Upload file
    result = upload_to_provider(folder_path, content, filename, content_type: content_type)

    Rails.logger.info("[#{self.class.name}] Uploaded to storage: #{folder_path}/#{filename}")

    {
      success: true,
      path: result[:path],
      url: result[:web_url] || result[:url],
      id: result[:id],
      raw: result
    }
  rescue DocumentProviders::Error => e
    Rails.logger.error("[#{self.class.name}] Storage error: #{e.message}")
    { success: false, error: "Storage error: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("[#{self.class.name}] Upload error: #{e.message}")
    { success: false, error: e.message }
  end

  # Download content from storage
  # Returns: { success: true, content: } or { success: false, error: }
  def download_from_storage(path_or_id)
    service = DocumentStorageService.new
    doc = OpenStruct.new(
      storage_path: path_or_id.to_s.start_with?("/") ? path_or_id : nil,
      storage_file_id: path_or_id.to_s.start_with?("/") ? nil : path_or_id
    )

    result = service.download(doc)

    if result[:success] && result[:content].present?
      { success: true, content: result[:content] }
    else
      { success: false, error: result[:error] || "Failed to download" }
    end
  rescue StandardError => e
    Rails.logger.error("[#{self.class.name}] Download error: #{e.message}")
    { success: false, error: e.message }
  end

  # Check if storage is connected (without raising)
  def storage_connected?
    setup_default_provider!
    true
  rescue DocumentProviders::NotConnectedError
    false
  end

  # Sanitize a path segment for storage
  def sanitize_storage_path(name)
    if defined?(SharePoint::FilenameSanitizer)
      SharePoint::FilenameSanitizer.sanitize_path_segment(name.to_s)
    else
      name.to_s.gsub(/[\\\\\/:"*?<>|]/, "_").strip
    end
  end
end
