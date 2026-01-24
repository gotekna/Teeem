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
  # SSoT Architecture (Jan 2026):
  #   1. Compute content_hash for deduplication
  #   2. Find or create StorageBlob (same file = same blob)
  #   3. Link record to StorageBlob
  #   4. Also set storage_path for backwards compatibility
  #
  # @param scope [Symbol] The storage scope (:job, :corporate, :contact, etc.)
  # @param record [ActiveRecord::Base] The document record to update
  # @param file [ActionDispatch::Http::UploadedFile, File, String] The file or content
  # @param tokens [Hash] Token values for path template (e.g., { JobCode: "J-001" })
  # @param filename [String] Optional filename override
  # @param content_type [String] Optional content type override
  # @return [Hash] { success: true/false, path: "...", blob_id: ..., deduplicated: true/false }
  def upload(scope:, record:, file:, tokens: {}, filename: nil, content_type: nil)
    unless @provider
      return error_result("No storage provider configured. Check StorageConfiguration.")
    end

    # Get file content and metadata
    file_content, file_name, mime_type = extract_file_data(file, filename, content_type)

    unless file_content.present?
      return error_result("No file content provided")
    end

    # SSoT: Compute content_hash for deduplication
    content_hash = Digest::SHA256.hexdigest(file_content)
    deduplicated = false

    # Check if this content already exists (deduplication)
    existing_blob = StorageBlob.find_by(content_hash: content_hash)

    if existing_blob
      # Content already exists - reuse the blob (no upload needed)
      Rails.logger.info "[DocumentStorage] DEDUP: Using existing blob #{existing_blob.id} for #{file_name}"
      deduplicated = true
      storage_path = existing_blob.storage_path
      blob = existing_blob
    else
      # Build the storage path using StorageConfiguration
      # SSoT: Pass record so we can use its EntityTab.storage_folder_path template
      folder_path = build_folder_path(scope, tokens, record: record)
      full_path = "#{folder_path}/#{sanitize_filename(file_name)}"

      Rails.logger.info "[DocumentStorage] Uploading to #{full_path} (#{file_content.bytesize} bytes)"

      # Upload to storage provider
      result = @provider.upload_file(folder_path, file_content, file_name, content_type: mime_type)
      storage_path = result[:path]

      # Create StorageBlob record
      blob = StorageBlob.create!(
        content_hash: content_hash,
        storage_path: storage_path,
        file_size: file_content.bytesize,
        original_filename: file_name,
        content_type: mime_type,
        reference_count: 0
      )

      Rails.logger.info "[DocumentStorage] SUCCESS: #{storage_path} (blob #{blob.id})"
    end

    # Update the record with storage_blob + backwards-compatible fields
    update_attrs = {}
    update_attrs[:storage_blob_id] = blob.id if record.respond_to?(:storage_blob_id=)
    update_attrs[:storage_path] = storage_path if record.respond_to?(:storage_path=)
    update_attrs[:content_hash] = content_hash if record.respond_to?(:content_hash=)

    record.update!(update_attrs) if update_attrs.any?

    # Increment reference count on blob
    blob.increment_reference!

    {
      success: true,
      path: storage_path,
      blob_id: blob.id,
      size: file_content.bytesize,
      deduplicated: deduplicated
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

  # Create a shareable link for a document
  #
  # SSoT Architecture (Jan 2026):
  #   - S3/Wasabi: Returns long-lived presigned URL (7 days default)
  #   - SharePoint: Creates persistent anonymous sharing link
  #
  # @param record [ActiveRecord::Base] Document with storage_path or storage_reference
  # @param expires_in [Integer] Expiry in seconds for S3 URLs (default: 7 days)
  # @param type [String] SharePoint link type: "view" or "edit" (default: "view")
  # @param scope [String] SharePoint scope: "anonymous" or "organization" (default: "anonymous")
  # @return [Hash] { success: true, share_url: "...", provider: :s3/:sharepoint }
  #                or { success: false, error: "..." }
  def create_share_link(record, expires_in: 604800, type: "view", scope: "anonymous")
    return error_result("No record provided") unless record

    # SSoT Priority:
    # 1. StorageBlob/storage_path → S3 presigned URL (new architecture)
    # 2. storage_reference → SharePoint share link (legacy)

    if has_s3_storage?(record)
      create_s3_share_link(record, expires_in: expires_in)
    elsif has_sharepoint_storage?(record)
      create_sharepoint_share_link(record, type: type, scope: scope)
    else
      error_result("Document not in storage (missing storage_path and storage_reference)")
    end
  rescue StandardError => e
    Rails.logger.error "[DocumentStorage] create_share_link error: #{e.class} - #{e.message}"
    error_result("Failed to create share link: #{e.message}")
  end

  # Get storage stats
  def stats
    {
      provider: @storage_config.provider_type,
      connected: @storage_config.connected?,
      root_path: @storage_config.root_path,
      available_scopes: @storage_config.effective_scope_folders.keys
    }
  end

  # ============================================================================
  # DOWNLOAD METHODS - SSoT: S3/Wasabi is THE storage provider
  # ============================================================================

  # Download file content from storage
  #
  # SSoT Priority (Jan 2026):
  #   1. StorageBlob (preferred - deduplicated storage)
  #   2. storage_path (S3/Wasabi direct)
  #
  # ActiveStorage REMOVED (Jan 2026) - all files now use StorageBlob or storage_path
  #
  # @param record [ActiveRecord::Base] Document with storage_blob or storage_path
  # @return [Hash] { success: true, content: binary, content_type: "...", filename: "..." }
  #                or { success: false, error: "...", status: :symbol }
  def download(record)
    return error_result("No record provided", status: :bad_request) unless record

    # SSoT: Prefer StorageBlob (deduplicated storage)
    if record.respond_to?(:storage_blob) && record.storage_blob.present?
      download_from_storage_blob(record)
    # Fallback: Direct S3/Wasabi storage
    elsif record.respond_to?(:storage_path) && record.storage_path.present?
      download_from_s3(record)
    else
      Rails.logger.warn "[DocumentStorage] Document #{record.class.name}##{record.id} has no storage - needs migration"
      error_result("Document not in storage (missing storage_blob and storage_path)", status: :not_found)
    end
  end

  # Generate presigned download URL (no binary transfer)
  #
  # SSoT Priority (Jan 2026):
  #   1. StorageBlob (preferred - deduplicated storage)
  #   2. storage_path (S3/Wasabi direct)
  #
  # Phase 3 (Jan 2026): Send Name support
  #   Downloads use warehouse_document.download_filename for custom filename
  #   This enables files to rename on download based on configured templates
  #
  # @param record [ActiveRecord::Base] Document model
  # @param expires_in [Integer] URL expiry in seconds (default: 3600)
  # @return [Hash] { success: true, url: "...", filename: "..." }
  def download_url(record, expires_in: 3600)
    return error_result("No record provided", status: :bad_request) unless record

    # SSoT: Prefer StorageBlob path
    storage_path = if record.respond_to?(:storage_blob) && record.storage_blob.present?
      record.storage_blob.storage_path
    elsif record.respond_to?(:storage_path) && record.storage_path.present?
      record.storage_path
    end

    if storage_path.present?
      # SSoT: Remove ALL leading slashes (fixes //filename paths from bad uploads)
      s3_key = storage_path.to_s.gsub(%r{^/+}, "")
      begin
        provider = s3_provider
        return error_result("S3 storage not configured", status: :service_unavailable) unless provider

        # Verify file exists before generating presigned URL
        # This prevents returning broken links for files that were never uploaded
        begin
          provider.get_file(s3_key)
        rescue DocumentProviders::NotFoundError
          Rails.logger.warn "[DocumentStorage] File not found in S3: #{s3_key} (record: #{record.class.name}##{record.id})"
          return error_result("File not found in storage: #{s3_key}", status: :not_found)
        end

        # SSoT: Get Send Name from warehouse_document (Phase 3)
        # This is the filename used when downloading (Content-Disposition header)
        send_name = resolve_send_name(record)

        url = provider.download_url(s3_key, expires_in: expires_in, filename: send_name)
        { success: true, url: url, filename: send_name }
      rescue DocumentProviders::NotFoundError
        error_result("File not found in S3 storage: #{s3_key}", status: :not_found)
      rescue DocumentProviders::NotConnectedError
        error_result("S3 storage not configured", status: :service_unavailable)
      rescue => e
        Rails.logger.error "[DocumentStorage] S3 URL error: #{e.message}"
        error_result("Failed to generate S3 URL: #{e.message}", status: :internal_server_error)
      end
    else
      # No storage = document not properly configured
      Rails.logger.warn "[DocumentStorage] Document #{record.class.name}##{record.id} has no storage - needs migration"
      error_result("Document not in storage (missing storage_blob and storage_path)", status: :not_found)
    end
  end

  private

  def get_storage_provider
    DocumentProviders.for_organization(Organization.first)
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

  # SSoT: ContentTypeDetector (lib/utils/content_type_detector.rb)
  def detect_content_type(filename, _content = nil)
    ContentTypeDetector.detect(filename)
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

  # Download via StorageBlob (SSoT for deduplicated storage)
  def download_from_storage_blob(record)
    blob = record.storage_blob
    s3_key = blob.storage_path.to_s.sub(%r{^/}, "")
    provider = s3_provider
    return error_result("S3 storage not configured", status: :service_unavailable) unless provider

    content = provider.download_file(s3_key)
    {
      success: true,
      content: content,
      content_type: blob.content_type || detect_content_type(record.file_name),
      filename: record.file_name || blob.original_filename
    }
  rescue DocumentProviders::NotFoundError
    error_result("File not found in storage: #{s3_key}", status: :not_found)
  rescue DocumentProviders::NotConnectedError
    error_result("S3 storage not configured", status: :service_unavailable)
  rescue => e
    Rails.logger.error "[DocumentStorage] StorageBlob download error for #{record.class.name}##{record.id}: #{e.message}"
    error_result("Failed to download file: #{e.message}", status: :internal_server_error)
  end

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

  # NOTE: download_from_sharepoint removed - S3/Wasabi is SSoT, no SharePoint fallback
  # NOTE: download_from_active_storage removed (Jan 2026) - ActiveStorage no longer used

  # NOTE: has_sharepoint_id? removed - S3/Wasabi is SSoT, no SharePoint fallback

  # Build the S3 key from storage_path + file_name
  # Handles legacy records where storage_path is just the folder (missing filename)
  #
  # ⚠️ EDGE CASE: Duplicate filename in path
  # Some records have storage_path like: "Tasks/2339/Attachments/ASIC Teeem Registration/ASIC Teeem Registration"
  # where the filename appears TWICE (folder/file both named the same).
  # The actual S3 object is at: "Tasks/2339/Attachments/ASIC Teeem Registration"
  # We detect and remove the duplication.
  def build_s3_key(record)
    path = record.storage_path.to_s.sub(%r{^/}, "")
    filename = record.file_name.to_s

    # ⚠️ Check for duplicate filename at end of path
    # If path ends with "/filename/filename" (same name twice), remove the duplicate
    # This handles bad data where storage_path was saved incorrectly with duplication
    if filename.present? && !filename.match?(/\.\w{2,5}$/)
      # Filename has no extension - check for duplicate pattern
      duplicate_suffix = "/#{filename}/#{filename}"
      if path.end_with?(duplicate_suffix)
        # Remove the duplicate - keep only one copy of filename
        return path.sub(/\/#{Regexp.escape(filename)}$/, "")
      end
    end

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

  # ============================================================================
  # SEND NAME RESOLUTION (Phase 3)
  # ============================================================================

  # SSoT: Resolve the Send Name for a document download
  #
  # Priority:
  #   1. record.display_name (user-friendly name, generated from templates)
  #   2. warehouse_document.download_filename (Phase 3 SSoT - sanitized + templated)
  #   3. record.file_name (original filename)
  #   4. storage_blob.original_filename (fallback)
  #   5. "document" (last resort)
  #
  # Note: display_name is checked FIRST because CorporateCompanyDocument generates
  # nice display names (e.g., "Invoice INV-0520") but the warehouse_document may
  # have been created earlier with just the raw file_name.
  #
  # @param record [ActiveRecord::Base] Document model
  # @return [String] The filename to use for download
  def resolve_send_name(record)
    # 1. Try display_name FIRST - this is the user-friendly name
    # CorporateCompanyDocument.generate_display_name creates names like "Invoice INV-0520"
    if record.respond_to?(:display_name) && record.display_name.present?
      display = record.display_name
      original = record.respond_to?(:file_name) ? record.file_name : nil

      # If display_name doesn't have extension, add it from original file_name
      if original.present?
        original_ext = File.extname(original)
        display_ext = File.extname(display)
        if display_ext.blank? && original_ext.present?
          return "#{display}#{original_ext}"
        end
      end
      return display
    end

    # 2. Try warehouse_document (Phase 3 SSoT)
    if record.respond_to?(:warehouse_document) && record.warehouse_document.present?
      return record.warehouse_document.download_filename
    end

    # 3. Try record's file_name
    if record.respond_to?(:file_name) && record.file_name.present?
      return record.file_name
    end

    # 4. Try storage_blob's original_filename
    if record.respond_to?(:storage_blob) && record.storage_blob&.original_filename.present?
      return record.storage_blob.original_filename
    end

    # 5. Last resort fallback
    "document"
  end

  # ============================================================================
  # SHARE LINK HELPERS (Private)
  # ============================================================================

  # Check if record has S3/Wasabi storage
  def has_s3_storage?(record)
    (record.respond_to?(:storage_blob) && record.storage_blob.present?) ||
      (record.respond_to?(:storage_path) && record.storage_path.present?)
  end

  # Check if record has SharePoint storage (legacy)
  def has_sharepoint_storage?(record)
    sharepoint_item_id(record).present?
  end

  # Get SharePoint item ID from record (different fields for different record types)
  def sharepoint_item_id(record)
    case record
    when SyncedEmail
      record.email_storage_file_id if record.respond_to?(:email_storage_file_id)
    else
      record.storage_reference if record.respond_to?(:storage_reference)
    end
  end

  # Create S3 presigned URL as share link
  def create_s3_share_link(record, expires_in:)
    result = download_url(record, expires_in: expires_in)
    if result[:success]
      { success: true, share_url: result[:url], provider: :s3_compatible, expires_in: expires_in }
    else
      result
    end
  end

  # Create SharePoint share link
  # SSoT: Uses MicrosoftAppGraphClient.create_share_link
  def create_sharepoint_share_link(record, type:, scope:)
    # Get appropriate credential based on record type
    credential, drive_id = resolve_sharepoint_credential_for(record)

    unless credential
      return error_result("SharePoint not configured")
    end

    unless drive_id
      return error_result("SharePoint drive not configured")
    end

    item_id = sharepoint_item_id(record)

    # Create share link via Graph API
    client = MicrosoftAppGraphClient.new(credential)
    result = client.create_share_link(
      drive_id: drive_id,
      item_id: item_id,
      type: type,
      scope: scope
    )

    if result[:url].present?
      { success: true, share_url: result[:url], provider: :sharepoint, type: type, scope: scope }
    else
      error_result("Failed to create SharePoint sharing link")
    end
  rescue MicrosoftAppGraphClient::NotConnectedError => e
    error_result(e.message)
  rescue MicrosoftAppGraphClient::APIError => e
    error_result("SharePoint API error: #{e.message}")
  end

  # Resolve the appropriate SharePoint credential and drive_id for a record
  # Different record types may be in different SharePoint locations
  def resolve_sharepoint_credential_for(record)
    case record
    when SyncedEmail
      # Emails use TEEEM's SharePoint (central storage)
      sp_config = MicrosoftCredential.teeem_sharepoint_config
      return [nil, nil] unless sp_config
      [sp_config[:credential], sp_config[:drive_id]]
    else
      # Other documents use org's SharePoint
      credential = MicrosoftCredential.sharepoint_credential
      drive_id = StorageConfiguration.instance&.drive_id
      [credential, drive_id]
    end
  end
end
