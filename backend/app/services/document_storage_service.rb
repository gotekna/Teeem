# frozen_string_literal: true

# DocumentStorageService - THE ONE SSoT for document storage operations
#
# Uses WarehouseProvider to determine paths and provider.
# Works with ANY document model that has a storage_path column.
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: WarehouseProvider determines WHERE files go             ║
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
# Supported scopes (from WarehouseProvider):
#   :job, :corporate, :people, :contact, :task, :email, :email_attachments, etc.
#
class DocumentStorageService
  attr_reader :storage_config, :provider, :tenant

  # SSoT: Requires explicit tenant or ActsAsTenant.current_tenant (Jan 2026 fix)
  # @param tenant [Tenant] The tenant context (optional, uses ActsAsTenant.current_tenant if not provided)
  def initialize(tenant: nil)
    @tenant = tenant || ActsAsTenant.current_tenant
    raise ::TenantNotFoundError, "Tenant required for DocumentStorageService" unless @tenant

    @storage_config = WarehouseProvider.for_tenant(@tenant)
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
      return error_result("No storage provider configured. Check WarehouseProvider.")
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
      # Build the storage path using WarehouseProvider
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
  # @param disposition [Symbol] :attachment (download) or :inline (view in browser)
  # @return [Hash] { success: true, share_url: "...", provider: :s3/:sharepoint }
  #                or { success: false, error: "..." }
  def create_share_link(record, expires_in: 604800, type: "view", scope: "anonymous", disposition: :attachment)
    return error_result("No record provided") unless record

    # SSoT Priority:
    # 1. StorageBlob/storage_path → S3 presigned URL (new architecture)
    # 2. storage_reference → SharePoint share link (legacy)
    # 3. SyncedEmail → Lazy self-heal (generate .eml from database)

    if has_s3_storage?(record)
      create_s3_share_link(record, expires_in: expires_in, disposition: disposition)
    elsif has_sharepoint_storage?(record)
      create_sharepoint_share_link(record, type: type, scope: scope)
    elsif record.is_a?(SyncedEmail)
      # Lazy self-heal: Upload email to storage on-demand, then create share link
      upload_result = upload_email_on_demand(record)
      if upload_result[:success]
        # Now that it's uploaded, create the share link
        create_s3_share_link(record.reload, expires_in: expires_in, disposition: disposition)
      else
        error_result("Document not in storage (missing storage_blob and storage_path)")
      end
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
  #   1. WarehouseDocument.storage_blob (Phase 3 SSoT - Blobs/ path)
  #   2. record.storage_blob (legacy fallback)
  #
  # ActiveStorage REMOVED (Jan 2026) - all files now use StorageBlob
  #
  # @param record [ActiveRecord::Base] Document with storage_blob or warehouse_document
  # @return [Hash] { success: true, content: binary, content_type: "...", filename: "..." }
  #                or { success: false, error: "...", status: :symbol }
  def download(record)
    return error_result("No record provided", status: :bad_request) unless record

    # SSoT: Phase 3 WarehouseDocument.storage_blob is THE ONE source
    # Priority: warehouse_document.storage_blob (Blobs/) > record.storage_blob (legacy)
    if record.respond_to?(:warehouse_document) && record.warehouse_document&.storage_blob.present?
      # Phase 3 SSoT: Use Blobs/ path from warehouse_document
      download_from_storage_blob_via_warehouse(record)
    elsif record.respond_to?(:storage_blob) && record.storage_blob.present?
      # Legacy fallback: direct storage_blob on record
      download_from_storage_blob(record)
    else
      # No storage - document needs to be synced
      Rails.logger.warn "[DocumentStorage] Document #{record.class.name}##{record.id} has no storage_blob - needs migration"

      # For SyncedEmail without storage: run UploadEmailsToStorageJob to sync
      if record.is_a?(SyncedEmail)
        Rails.logger.info "[DocumentStorage] Email #{record.id} has no storage - run UploadEmailsToStorageJob to sync"
      end

      error_result("Document not in storage (missing storage_blob)", status: :not_found)
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
  # @param disposition [Symbol] :attachment (download) or :inline (view in browser)
  # @return [Hash] { success: true, url: "...", filename: "..." }
  def download_url(record, expires_in: 3600, disposition: :attachment)
    return error_result("No record provided", status: :bad_request) unless record

    # SSoT: Phase 3 WarehouseDocument.storage_blob is THE ONE source for file paths
    # Priority: warehouse_document.storage_blob (Blobs/ path) > record.storage_blob (legacy path)
    # This ensures migrated documents use the correct content-addressed storage path
    storage_path = if record.respond_to?(:warehouse_document) && record.warehouse_document&.storage_blob.present?
      # Phase 3 SSoT: Use Blobs/ path from warehouse_document (actual file location)
      record.warehouse_document.storage_blob.storage_path
    elsif record.respond_to?(:storage_blob) && record.storage_blob.present?
      # Legacy fallback: direct storage_blob on record
      record.storage_blob.storage_path
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
          # File is missing from S3 - log details for debugging but show user-friendly message
          Rails.logger.warn "[DocumentStorage] File not found in S3: #{s3_key} (record: #{record.class.name}##{record.id})"

          # Mark document as having missing file (for tracking/cleanup) if it supports this
          if record.respond_to?(:update_column) && record.respond_to?(:file_missing)
            record.update_column(:file_missing, true) rescue nil
          end

          # For SyncedEmail without storage: queue re-sync via UploadEmailsToStorageJob
          if record.is_a?(SyncedEmail)
            Rails.logger.info "[DocumentStorage] Email #{record.id} missing from storage - run UploadEmailsToStorageJob to sync"
          end

          # User-friendly error - don't expose internal paths
          return error_result("Document file is unavailable - the file may have been moved or deleted", status: :not_found)
        end

        # SSoT: Get Send Name from warehouse_document (Phase 3)
        # This is the filename used when downloading (Content-Disposition header)
        send_name = resolve_send_name(record)

        url = provider.download_url(s3_key, expires_in: expires_in, filename: send_name, disposition: disposition)
        { success: true, url: url, filename: send_name }
      rescue DocumentProviders::NotFoundError
        # User-friendly error - don't expose internal paths
        Rails.logger.warn "[DocumentStorage] File not found after URL generation: #{s3_key}"
        error_result("Document file is unavailable - the file may have been moved or deleted", status: :not_found)
      rescue DocumentProviders::NotConnectedError
        error_result("S3 storage not configured", status: :service_unavailable)
      rescue => e
        Rails.logger.error "[DocumentStorage] S3 URL error: #{e.message}"
        error_result("Failed to generate S3 URL: #{e.message}", status: :internal_server_error)
      end
    else
      # No storage = document not properly configured
      Rails.logger.warn "[DocumentStorage] Document #{record.class.name}##{record.id} has no storage - needs migration"

      # For SyncedEmail without storage: run UploadEmailsToStorageJob to sync
      if record.is_a?(SyncedEmail)
        Rails.logger.info "[DocumentStorage] Email #{record.id} has no storage - run UploadEmailsToStorageJob to sync"
      end

      error_result("Document not in storage (missing storage_blob and storage_path)", status: :not_found)
    end
  end

  private

  def get_storage_provider
    # SSoT: Use tenant for provider (Jan 2026 fix)
    DocumentProviders.for_tenant(@tenant)
  rescue ::TenantNotFoundError => e
    Rails.logger.error "[DocumentStorage] Failed to get provider - no tenant: #{e.message}"
    nil
  rescue StandardError => e
    Rails.logger.error "[DocumentStorage] Failed to get provider: #{e.message}"
    nil
  end

  # Build folder path from scope and tokens
  # SSoT Priority:
  # 1. Record's storage_folder_template (from EntityTab.storage_folder_path - database)
  # 2. WarehouseProvider.template_for(scope) (fallback)
  def build_folder_path(scope, tokens, record: nil)
    # Get base path from WarehouseProvider
    base_path = @storage_config.path_for(scope)

    # SSoT: Try to get template from record's EntityTab first (database-stored)
    # Falls back to WarehouseProvider constant if not available
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

  # Download via WarehouseDocument's StorageBlob (Phase 3 SSoT)
  # Used for records like SyncedEmail that have warehouse_document but no direct storage_blob
  def download_from_storage_blob_via_warehouse(record)
    blob = record.warehouse_document.storage_blob
    s3_key = blob.storage_path.to_s.sub(%r{^/}, "")
    provider = s3_provider
    return error_result("S3 storage not configured", status: :service_unavailable) unless provider

    content = provider.download_file(s3_key)
    {
      success: true,
      content: content,
      content_type: blob.content_type || detect_content_type(record.respond_to?(:file_name) ? record.file_name : nil),
      filename: record.respond_to?(:file_name) ? record.file_name : blob.original_filename
    }
  rescue DocumentProviders::NotFoundError
    error_result("File not found in storage: #{s3_key}", status: :not_found)
  rescue DocumentProviders::NotConnectedError
    error_result("S3 storage not configured", status: :service_unavailable)
  rescue => e
    Rails.logger.error "[DocumentStorage] WarehouseDocument download error for #{record.class.name}##{record.id}: #{e.message}"
    error_result("Failed to download file: #{e.message}", status: :internal_server_error)
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
  #   1. SyncedEmail: Use subject as filename (simple, no date prefix)
  #   2. record.display_name (user-friendly name, generated from templates)
  #   3. warehouse_document.download_filename (Phase 3 SSoT - sanitized + templated)
  #   4. record.file_name (original filename)
  #   5. storage_blob.original_filename (fallback)
  #   6. "document" (last resort)
  #
  # Note: display_name is checked FIRST because document models generate
  # nice display names (e.g., "Invoice INV-0520") but the warehouse_document may
  # have been created earlier with just the raw file_name.
  #
  # @param record [ActiveRecord::Base] Document model
  # @return [String] The filename to use for download
  def resolve_send_name(record)
    # 0. SyncedEmail: Use subject directly (no date prefix needed for emails)
    if record.is_a?(SyncedEmail)
      subject = record.subject.presence || "Email"
      # Sanitize filename (remove characters that break filenames)
      safe_subject = subject.gsub(/[<>:"\/\\|?*\r\n]/, " ").gsub(/\s+/, " ").strip.truncate(100, omission: "")
      return "#{safe_subject}.eml"
    end

    # 1. WarehouseDocument: Use download_filename (SSoT via SendNameResolver)
    # FRC (Jan 2026): Email attachments are WarehouseDocuments with proper display_name.
    # The download_filename method handles full resolution with templates.
    if record.is_a?(WarehouseDocument)
      return record.download_filename
    end

    # 2. Try display_name FIRST - this is the user-friendly name
    # Various document models generate display names like "Invoice INV-0520"
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

    # 3. Try warehouse_document (Phase 3 SSoT)
    if record.respond_to?(:warehouse_document) && record.warehouse_document.present?
      return record.warehouse_document.download_filename
    end

    # 4. Try record's file_name
    if record.respond_to?(:file_name) && record.file_name.present?
      return record.file_name
    end

    # 5. Try storage_blob's original_filename
    if record.respond_to?(:storage_blob) && record.storage_blob&.original_filename.present?
      return record.storage_blob.original_filename
    end

    # 6. Last resort fallback
    "document"
  end

  # ============================================================================
  # SHARE LINK HELPERS (Private)
  # ============================================================================

  # Check if record has S3/Wasabi storage via StorageBlob (SSoT)
  # Priority: warehouse_document.storage_blob (Phase 3 SSoT) > record.storage_blob (legacy)
  def has_s3_storage?(record)
    (record.respond_to?(:warehouse_document) && record.warehouse_document&.storage_blob.present?) ||
      (record.respond_to?(:storage_blob) && record.storage_blob.present?)
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
  def create_s3_share_link(record, expires_in:, disposition: :attachment)
    result = download_url(record, expires_in: expires_in, disposition: disposition)
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
      drive_id = WarehouseProvider.instance&.drive_id
      [credential, drive_id]
    end
  end

  # ============================================================================
  # LAZY SELF-HEAL: Upload email on-demand (FRC fix Jan 2026)
  # ============================================================================

  # Upload a SyncedEmail to storage on-demand
  #
  # This is called when creating a share link for an email that hasn't been
  # uploaded yet. Fetches .eml content from Graph API and uploads to S3.
  #
  # @param email [SyncedEmail] The email to upload
  # @return [Hash] { success: true } or { success: false, error: "..." }
  def upload_email_on_demand(email)
    Rails.logger.info "[DocumentStorage] Lazy self-heal: Uploading email #{email.id} on-demand"

    # Skip if already uploaded (race condition check)
    # Check storage_path (direct) and warehouse_document.storage_blob (Phase 3 SSoT)
    if email.storage_path.present? || email.warehouse_document&.storage_blob.present?
      Rails.logger.info "[DocumentStorage] Email #{email.id} already has storage, skipping upload"
      return { success: true }
    end

    # Need outlook_id and mailbox to fetch from Graph API
    unless email.outlook_id.present? && email.mailbox_owner_email.present?
      Rails.logger.warn "[DocumentStorage] Email #{email.id} missing outlook_id or mailbox_owner_email"
      return { success: false, error: "Email metadata incomplete" }
    end

    # Get credential to fetch from Graph API
    credential = get_credential_for_email(email)
    unless credential&.connected?
      Rails.logger.warn "[DocumentStorage] No valid credential for email #{email.id}"
      return { success: false, error: "No Graph API credential available" }
    end

    # Fetch .eml content from Graph API
    Rails.logger.info "[DocumentStorage] Fetching email #{email.id} from #{email.mailbox_owner_email}"
    client = MicrosoftAppGraphClient.new(credential)
    mime_content = client.get_email_mime_content(email.mailbox_owner_email, email.outlook_id)

    unless mime_content.present?
      Rails.logger.warn "[DocumentStorage] Could not fetch email #{email.id} content"
      return { success: false, error: "Could not fetch email content from Outlook" }
    end

    Rails.logger.info "[DocumentStorage] Got #{mime_content.bytesize} bytes for email #{email.id}, uploading..."

    # Create StorageBlob (content-addressed storage)
    blob = StorageBlob.find_or_create_for_content!(
      mime_content,
      filename: "#{email.id}.eml",
      content_type: "message/rfc822"
    )

    # Update email record with storage path
    email.update_columns(
      storage_path: blob.storage_path,
      storage_file_id: blob.id.to_s,
      storage_email_path: blob.storage_path,
      storage_email_file_id: blob.id.to_s
    )

    # Create WarehouseDocument for file warehouse (if not exists)
    create_warehouse_document_for_email(email, blob)

    Rails.logger.info "[DocumentStorage] Lazy self-heal SUCCESS: Email #{email.id} uploaded to #{blob.storage_path}"
    { success: true, path: blob.storage_path }
  rescue MicrosoftAppGraphClient::NotConnectedError => e
    Rails.logger.error "[DocumentStorage] Graph API not connected for email #{email.id}: #{e.message}"
    { success: false, error: "Outlook connection required" }
  rescue MicrosoftAppGraphClient::APIError => e
    Rails.logger.error "[DocumentStorage] Graph API error for email #{email.id}: #{e.message}"
    { success: false, error: "Could not fetch email: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error "[DocumentStorage] Failed to upload email #{email.id}: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(3).join("\n")
    { success: false, error: e.message }
  end

  # Get a credential that can fetch this email
  # Priority: credential that synced this email > any connected credential
  def get_credential_for_email(email)
    # Try the credential that synced this email first
    if email.microsoft_credential_id.present?
      cred = MicrosoftCredential.find_by(id: email.microsoft_credential_id)
      return cred if cred&.connected?
    end

    # Fall back to any connected app credential
    MicrosoftCredential.active_credential
  end

  # Create WarehouseDocument for email (copied from EmailStorageUploadService for consistency)
  def create_warehouse_document_for_email(email, blob)
    return if email.warehouse_document.present?

    WarehouseDocument.create!(
      documentable: email,
      storage_blob: blob,
      source_type: "email",
      folder: email.virtual_folder_path,
      display_name: email.subject.presence || "No Subject",
      original_filename: "#{email.id}.eml",
      tenant_id: @tenant.id,
      metadata: {
        subject: email.subject,
        from_email: email.from_email,
        received_at: email.received_at&.iso8601,
        mailbox: email.mailbox_owner_email
      }
    )

    blob.increment!(:reference_count)
    Rails.logger.debug "[DocumentStorage] Created WarehouseDocument for email #{email.id}"
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "[DocumentStorage] Failed to create WarehouseDocument for email #{email.id}: #{e.message}"
  end
end
