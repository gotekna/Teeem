# frozen_string_literal: true

# StorageBlob - SSoT for deduplicated file storage
#
# Purpose: Store files ONCE based on content_hash, link from multiple records
#
# Architecture:
#   WarehouseProvider (determines provider: wasabi, s3, sharepoint, azure)
#      ↓
#   StorageBlob (one per unique file)
#   ├── content_hash: SHA256 of file content (unique)
#   ├── storage_path: Where file lives in provider
#   ├── reference_count: How many records link to this blob
#      ↓
#   WarehouseDocument (link via storage_blob_id)
#
# Deduplication:
#   Same file sent to 100 users = 1 StorageBlob, 100 WarehouseDocuments
#
# SSoT: Uses TenantResolvable for fail-fast tenant derivation (Jan 2026 fix)
#
# Usage:
#   blob = StorageBlob.find_or_create_for_content!(content, filename: "doc.pdf", tenant: current_tenant)
#   attachment.update!(storage_blob: blob)
#
class StorageBlob < ApplicationRecord
  include TenantResolvable
  include MimeTypes

  # Multi-tenancy (Jan 2026)
  acts_as_tenant :tenant

  # Associations
  # Note: email_attachments and corporate_company_documents tables DROPPED (Jan 2026)
  # All documents now use WarehouseDocument as SSoT (Ultra Design)
  has_many :chat_messages, dependent: :nullify
  has_many :bill_inboxes, dependent: :nullify
  has_many :warehouse_documents, dependent: :nullify  # SSoT: Universal document table

  # Validations
  # content_hash is optional for legacy records (backfill without download)
  # New uploads always have content_hash for deduplication
  validates :content_hash, uniqueness: true, allow_nil: true
  validates :storage_path, presence: true, uniqueness: true

  # Scopes
  scope :orphaned, -> { where(reference_count: 0) }
  scope :with_references, -> { where("reference_count > 0") }
  scope :verified, -> { where.not(verified_at: nil) }
  scope :unverified, -> { where(verified_at: nil) }
  scope :with_content, -> { where.not(content_hash: nil) }  # Has actual file content
  scope :empty_placeholder, -> { where(content_hash: nil) }  # Placeholder blobs without actual files

  # Migration status scopes (Phase 0 file recovery)
  scope :needing_migration, -> { where(needs_migration: true) }
  scope :missing_file, -> { where(file_missing: true) }
  scope :has_file, -> { where(file_missing: false) }

  # Mark blob as verified (file exists in storage)
  def mark_verified!
    update_column(:verified_at, Time.current)
  end

  # Bulk mark blobs as verified
  def self.mark_verified!(ids)
    where(id: ids).update_all(verified_at: Time.current)
  end

  # Find or create blob from a file on disk (O(1) memory)
  # Uses Digest::SHA256.file() which reads in 4KB chunks — never loads file into heap.
  # Upload uses File.open IO which AWS SDK streams in MULTIPART_CHUNK_SIZE chunks.
  #
  # ⚠️ MEMORY-SAFE (Feb 2026): This is the preferred method for large files (PDFs, attachments).
  # Use find_or_create_for_content! only for small in-memory content (<1MB).
  #
  # Same race-condition retry logic as find_or_create_for_content!
  # Caller is responsible for Tempfile cleanup (use ensure block).
  #
  # @param file_path [String] Path to file on disk (Tempfile or regular file)
  # @param filename [String] Original filename for storage path and content type detection
  # @param content_type [String] MIME type (auto-detected from filename if nil)
  # @return [StorageBlob] The found or created blob
  def self.find_or_create_from_file!(file_path, filename: nil, content_type: nil)
    hash = Digest::SHA256.file(file_path).hexdigest
    file_size = File.size(file_path)
    was_new = false

    blob = find_or_create_by!(content_hash: hash) do |b|
      was_new = true
      b.file_size = file_size
      b.original_filename = filename
      b.content_type = ensure_correct_content_type(
        content_type || detect_content_type_from_file(file_path, filename),
        filename
      )
      b.storage_path = generate_storage_path(hash, filename)
      b.reference_count = 0

      # Upload to storage provider from file IO (memory-safe)
      upload_from_file!(b, file_path)
    end

    # FRC: For existing blobs, verify file actually exists and re-upload from disk if missing
    unless was_new
      ensure_file_exists_from_path!(blob, file_path)
    end

    blob.mark_verified! if blob.verified_at.nil?
    blob
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
    if e.message.downcase.include?("content hash") || e.message.downcase.include?("storage path")
      3.times do |attempt|
        sleep(0.1 * (attempt + 1))
        Rails.logger.info "[StorageBlob] Race condition on hash #{hash[0..7]}..., retry find attempt #{attempt + 1} (unscoped)"
        retry_blob = unscoped.find_by(content_hash: hash)
        if retry_blob
          if retry_blob.tenant_id.nil? && ActsAsTenant.current_tenant
            retry_blob.update_column(:tenant_id, ActsAsTenant.current_tenant.id)
            Rails.logger.info "[StorageBlob] Adopted orphan blob #{retry_blob.id} into tenant #{ActsAsTenant.current_tenant.id}"
          end
          return retry_blob
        end
      end
      Rails.logger.error "[StorageBlob] Race condition on hash #{hash[0..7]}... but blob not found after 3 retries"
    end
    raise
  end

  # Find or create blob for content
  # Returns existing blob if content_hash matches, otherwise creates new
  #
  # ⚠️ RACE CONDITION HANDLING (Jan 2026):
  # Parallel processing (e.g., email upload jobs) can cause two threads to
  # compute the same hash simultaneously. Both try find_or_create_by! and
  # one fails with RecordNotUnique on content_hash. We rescue and retry find.
  #
  # ⚠️ FRC (Jan 2026): MISSING FILE RECOVERY
  # When reusing existing blob (deduplication), the original upload may have failed.
  # We now verify file exists and re-upload if missing. This prevents "File not found"
  # errors when accessing deduplicated content.
  def self.find_or_create_for_content!(content, filename: nil, content_type: nil)
    hash = compute_hash(content)
    was_new = false

    blob = find_or_create_by!(content_hash: hash) do |b|
      was_new = true
      b.file_size = content.bytesize
      b.original_filename = filename
      # Guard: Ensure content_type is correct, especially for PDFs
      # Curl uploads often send wrong content_type (octet-stream)
      b.content_type = ensure_correct_content_type(
        content_type || detect_content_type(content, filename),
        filename
      )
      b.storage_path = generate_storage_path(hash, filename)
      b.reference_count = 0

      # Upload to storage provider
      upload_to_storage!(b, content)
    end

    # FRC (Jan 2026): For existing blobs, verify file actually exists
    # If original upload failed, the blob record exists but file doesn't
    # We have the content NOW, so re-upload if missing
    unless was_new
      ensure_file_exists!(blob, content)
    end

    # Mark as verified after successful upload (new or recovered)
    blob.mark_verified! if blob.verified_at.nil?

    blob
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
    # Race condition: another thread created the blob first
    # ⚠️ FRC (Feb 2026): MUST use unscoped for retry find.
    # content_hash has a GLOBAL unique index (no tenant_id), but acts_as_tenant
    # scopes find_by to current tenant. Old blobs with nil tenant_id or blobs
    # from concurrent threads block creation via DB constraint but are invisible
    # to tenant-scoped find_by. This caused infinite retry failures in production.
    #
    # ⚠️ FRC (Feb 2026): Retry with backoff for transaction isolation.
    # Under concurrent writes, the conflicting row may not be visible immediately
    # due to PostgreSQL's MVCC. A brief sleep allows the inserting transaction to
    # commit and become visible to our unscoped.find_by.
    if e.message.downcase.include?("content hash") || e.message.downcase.include?("storage path")
      3.times do |attempt|
        sleep(0.1 * (attempt + 1)) # 100ms, 200ms, 300ms
        Rails.logger.info "[StorageBlob] Race condition on hash #{hash[0..7]}..., retry find attempt #{attempt + 1} (unscoped)"
        retry_blob = unscoped.find_by(content_hash: hash)
        if retry_blob
          # If blob exists in different tenant, update to current tenant for proper scoping
          if retry_blob.tenant_id.nil? && ActsAsTenant.current_tenant
            retry_blob.update_column(:tenant_id, ActsAsTenant.current_tenant.id)
            Rails.logger.info "[StorageBlob] Adopted orphan blob #{retry_blob.id} into tenant #{ActsAsTenant.current_tenant.id}"
          end
          return retry_blob
        end
      end
      Rails.logger.error "[StorageBlob] Race condition on hash #{hash[0..7]}... but blob not found after 3 retries"
    end
    raise # Re-raise if not a race condition we can handle
  end

  # FRC (Jan 2026): Verify file exists in storage, re-upload if missing
  # This recovers from failed original uploads when deduplication finds existing blob
  def self.ensure_file_exists!(blob, content)
    return if blob.verified_at.present? # Already verified, skip check

    provider = storage_provider
    if provider.file_exists?(blob.storage_path)
      Rails.logger.debug "[StorageBlob] File verified for blob #{blob.id}"
    else
      Rails.logger.warn "[StorageBlob] File missing for blob #{blob.id}, re-uploading..."
      upload_to_storage!(blob, content)
      Rails.logger.info "[StorageBlob] File recovered for blob #{blob.id}"
    end
  rescue StandardError => e
    # Don't fail the entire operation if verification fails
    # The presigned URL path still works for existing files
    Rails.logger.error "[StorageBlob] File verification failed for blob #{blob.id}: #{e.message}"
  end

  # Compute SHA256 hash of content
  def self.compute_hash(content)
    Digest::SHA256.hexdigest(content)
  end

  # Increment reference count (thread-safe)
  def increment_reference!
    with_lock do
      increment!(:reference_count)
    end
  end

  # Decrement reference count (thread-safe)
  def decrement_reference!
    with_lock do
      decrement!(:reference_count)
    end
  end

  # Check if blob has no references (can be garbage collected)
  def orphaned?
    reference_count.zero?
  end

  # Get file content from storage
  def download
    provider = storage_provider
    provider.download_file(storage_path)
  end

  # Get presigned download URL
  # @param expires_in [Integer] Expiry time in seconds (default: from TenantSetting.link_expiry_seconds)
  # @param filename [String] Custom download filename (optional)
  # @param disposition [Symbol] :inline (view in browser) or :attachment (force download)
  #   Default: :inline for PDFs/images, :attachment for other files
  # @return [String] Presigned download URL
  def presigned_url(expires_in: nil, filename: nil, disposition: nil)
    # Default expiry from company settings (SSoT)
    expires_in ||= TenantSetting.link_expiry_seconds

    # Default disposition based on content type:
    # - PDFs and images open inline (in browser)
    # - Other files force download
    disposition ||= viewable_content_type? ? :inline : :attachment

    provider = storage_provider
    provider.download_url(
      storage_path,
      expires_in: expires_in,
      filename: filename || original_filename,
      disposition: disposition
    )
  end

  # Check if content type can be viewed inline in browser
  def viewable_content_type?
    return false unless content_type.present?

    content_type.start_with?("image/") ||
      content_type == PDF ||
      content_type.start_with?("text/")
  end

  # Delete file from storage (only if orphaned)
  def delete_from_storage!
    return false unless orphaned?

    provider = storage_provider
    provider.delete_file(storage_path)
    destroy!
    true
  end

  private

  def self.detect_content_type(content, filename)
    return nil unless defined?(Marcel)

    Marcel::MimeType.for(content, name: filename)
  rescue StandardError => e
    Rails.logger.warn "[StorageBlob] Failed to detect content type for '#{filename}': #{e.message}"
    nil
  end

  # Guard: Fix common content_type misdetections
  # Curl uploads often send application/octet-stream for valid PDFs/images
  # This ensures we use filename extension when content_type is generic
  EXTENSION_CONTENT_TYPES = {
    ".pdf" => PDF,
    ".jpg" => JPEG,
    ".jpeg" => JPEG,
    ".png" => PNG,
    ".gif" => GIF,
    ".webp" => "image/webp",
    ".svg" => "image/svg+xml",
    ".txt" => "text/plain",
    ".csv" => CSV,
    ".json" => JSON,
    ".xml" => "application/xml",
    ".doc" => "application/msword",
    ".docx" => DOCX,
    ".xls" => "application/vnd.ms-excel",
    ".xlsx" => XLSX
  }.freeze

  def self.ensure_correct_content_type(detected_type, filename)
    return detected_type if filename.blank?

    # If detected type is generic (octet-stream or nil), use filename extension
    if detected_type.blank? || detected_type == OCTET_STREAM
      ext = File.extname(filename).downcase
      return EXTENSION_CONTENT_TYPES[ext] if EXTENSION_CONTENT_TYPES[ext]
    end

    detected_type
  end

  def self.generate_storage_path(hash, filename)
    # Use hash prefix for directory sharding (prevents too many files in one dir)
    # Example: Blobs/ab/abcdef123456.pdf
    prefix = hash[0..1]
    extension = filename ? File.extname(filename) : ""
    "Blobs/#{prefix}/#{hash}#{extension}"
  end

  def self.upload_to_storage!(blob, content)
    provider = storage_provider
    result = provider.upload_file(
      File.dirname(blob.storage_path),
      content,
      File.basename(blob.storage_path),
      content_type: blob.content_type
    )

    # Update with actual storage path if different
    # SSoT: Strip leading slash - paths should be relative (e.g., "Blobs/00/hash.eml" not "/Blobs/...")
    blob.storage_path = result[:path].to_s.sub(%r{^/+}, "") if result[:path].present?
  end

  # Upload from file IO — memory-safe, AWS SDK streams from disk
  # ⚠️ MEMORY-SAFE (Feb 2026): Never loads file content into Ruby heap.
  # Opens file as IO and passes directly to provider — AWS SDK reads in chunks.
  def self.upload_from_file!(blob, file_path)
    provider = storage_provider
    io = File.open(file_path, "rb")
    begin
      result = provider.upload_file(
        File.dirname(blob.storage_path),
        io,
        File.basename(blob.storage_path),
        content_type: blob.content_type
      )
      blob.storage_path = result[:path].to_s.sub(%r{^/+}, "") if result[:path].present?
    ensure
      io.close
    end
  end

  # Verify file exists in storage, re-upload from disk if missing
  # Like ensure_file_exists! but uses file path instead of in-memory content
  def self.ensure_file_exists_from_path!(blob, file_path)
    return if blob.verified_at.present?

    provider = storage_provider
    if provider.file_exists?(blob.storage_path)
      Rails.logger.debug "[StorageBlob] File verified for blob #{blob.id}"
    else
      Rails.logger.warn "[StorageBlob] File missing for blob #{blob.id}, re-uploading from disk..."
      upload_from_file!(blob, file_path)
      Rails.logger.info "[StorageBlob] File recovered for blob #{blob.id}"
    end
  rescue StandardError => e
    Rails.logger.error "[StorageBlob] File verification failed for blob #{blob.id}: #{e.message}"
  end

  # Detect content type from file on disk (without loading into memory)
  def self.detect_content_type_from_file(file_path, filename)
    return nil unless defined?(Marcel)

    # Marcel can detect from IO (reads magic bytes only) + filename
    File.open(file_path, "rb") do |f|
      Marcel::MimeType.for(f, name: filename)
    end
  rescue StandardError => e
    Rails.logger.warn "[StorageBlob] Failed to detect content type for file '#{filename}': #{e.message}"
    nil
  end

  # SSoT: Get storage provider for a tenant (Jan 2026 fix)
  # Class method for creating blobs - requires explicit tenant
  def self.storage_provider_for_tenant(tenant)
    raise ::TenantNotFoundError, "Tenant required for storage_provider" unless tenant

    DocumentProviders.for_tenant(tenant)
  end

  # DEPRECATED: Use storage_provider_for_tenant instead
  def self.storage_provider(organization = nil)
    Rails.logger.warn "[DEPRECATED] StorageBlob.storage_provider(org) - use storage_provider_for_tenant(tenant) instead"

    if organization
      # Derive tenant from organization
      tenant = organization.tenant
      raise ::TenantNotFoundError.new(context: "StorageBlob.storage_provider - organization has no tenant") unless tenant
      return DocumentProviders.for_tenant(tenant)
    end

    # Try current tenant from ActsAsTenant
    tenant = ActsAsTenant.current_tenant
    raise ::TenantNotFoundError, "Tenant context required for StorageBlob.storage_provider" unless tenant

    DocumentProviders.for_tenant(tenant)
  end

  # Instance method: finds tenant from linked records via TenantResolvable
  def storage_provider
    tenant = find_tenant_from_links
    self.class.storage_provider_for_tenant(tenant)
  end

  private

  # Find tenant through linked records (warehouse_documents -> documentable -> tenant)
  # Uses TenantResolvable pattern for fail-fast behavior
  # Note: email_attachments table DROPPED (Jan 2026) - all attachments now in WarehouseDocument
  def find_tenant_from_links
    # SSoT: All documents now go through WarehouseDocument
    if warehouse_documents.any?
      doc = warehouse_documents.first
      # Try direct tenant access
      return doc.tenant if doc.respond_to?(:tenant) && doc.tenant.present?
      # Try documentable chain
      if doc.documentable.present?
        return doc.documentable.tenant if doc.documentable.respond_to?(:tenant) && doc.documentable.tenant.present?
        # FRC (Jan 2026): Must check tenant.present? - nil microsoft_credential returns nil chain
        doc_ms_tenant = doc.documentable.microsoft_credential&.organization&.tenant if doc.documentable.respond_to?(:microsoft_credential)
        return doc_ms_tenant if doc_ms_tenant.present?
      end
    end

    # Try ActsAsTenant.current_tenant
    if ActsAsTenant.current_tenant.present?
      Rails.logger.debug "[StorageBlob] Using ActsAsTenant.current_tenant for #{id}"
      return ActsAsTenant.current_tenant
    end

    # FAIL FAST - No tenant found
    Rails.logger.error "[StorageBlob] No tenant found for #{id}"
    raise ::TenantNotFoundError.new(record: self, context: "StorageBlob#find_tenant_from_links")
  end
end
