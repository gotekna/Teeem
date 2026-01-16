# frozen_string_literal: true

# StorageBlob - SSoT for deduplicated file storage
#
# Purpose: Store files ONCE based on content_hash, link from multiple records
#
# Architecture:
#   StorageConfiguration (determines provider: wasabi, s3, sharepoint, azure)
#      ↓
#   StorageBlob (one per unique file)
#   ├── content_hash: SHA256 of file content (unique)
#   ├── storage_path: Where file lives in provider
#   ├── reference_count: How many records link to this blob
#      ↓
#   EmailAttachment, etc. (link via storage_blob_id)
#
# Deduplication:
#   Same file sent to 100 users = 1 StorageBlob, 100 EmailAttachments
#
# Usage:
#   blob = StorageBlob.find_or_create_for_content!(content, filename: "doc.pdf")
#   attachment.update!(storage_blob: blob)
#
class StorageBlob < ApplicationRecord
  # Associations
  has_many :email_attachments, dependent: :nullify
  has_many :corporate_company_documents, dependent: :nullify
  has_many :chat_messages, dependent: :nullify
  has_many :bill_inboxes, dependent: :nullify
  has_many :warehouse_documents, dependent: :nullify  # Phase 3: Universal document table

  # Validations
  # content_hash is optional for legacy records (backfill without download)
  # New uploads always have content_hash for deduplication
  validates :content_hash, uniqueness: true, allow_nil: true
  validates :storage_path, presence: true, uniqueness: true

  # Scopes
  scope :orphaned, -> { where(reference_count: 0) }
  scope :with_references, -> { where("reference_count > 0") }

  # Find or create blob for content
  # Returns existing blob if content_hash matches, otherwise creates new
  def self.find_or_create_for_content!(content, filename: nil, content_type: nil)
    hash = compute_hash(content)

    find_or_create_by!(content_hash: hash) do |blob|
      blob.file_size = content.bytesize
      blob.original_filename = filename
      blob.content_type = content_type || detect_content_type(content, filename)
      blob.storage_path = generate_storage_path(hash, filename)
      blob.reference_count = 0

      # Upload to storage provider
      upload_to_storage!(blob, content)
    end
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
  rescue StandardError
    nil
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
    blob.storage_path = result[:path] if result[:path].present?
  end

  def self.storage_provider
    DocumentProviders.for_organization(Organization.first)
  end

  def storage_provider
    self.class.storage_provider
  end
end
