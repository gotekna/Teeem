# Links email_warehouse records to their attachments
#
# SSoT Architecture:
#   EmailAttachment → StorageBlob (deduplicated storage via content_hash)
#
# Deduplication: Same file sent to 100 users = 1 StorageBlob, 100 EmailAttachments
#
# Storage is provider-agnostic (Wasabi, S3, SharePoint, Azure) via StorageConfiguration
#
class EmailAttachment < ApplicationRecord
  # Note: FK is email_warehouse_id (historical naming - email_warehouse was renamed to synced_email)
  belongs_to :synced_email, foreign_key: :email_warehouse_id
  # Alias for backwards compatibility
  alias_method :email_warehouse, :synced_email
  belongs_to :storage_blob, optional: true  # SSoT: Deduplicated file storage
  belongs_to :attachment, optional: true  # Legacy: Link to Attachment model (deprecated)

  # Phase 3: Universal warehouse metadata (SSoT for display_name, send_name, folder)
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # Scopes
  scope :linked_to_document, -> { where(is_existing_doc: true) }
  scope :standalone, -> { where(is_existing_doc: false) }
  # SSoT: storage_blob_id is the storage reference
  scope :with_storage_blob, -> { where.not(storage_blob_id: nil) }
  scope :without_storage_blob, -> { where(storage_blob_id: nil) }
  # Legacy: sharepoint_path (not sharepoint_file_id)
  scope :synced_to_sharepoint, -> { where.not(sharepoint_path: nil) }
  scope :pending_sync, -> { where(sharepoint_path: nil, storage_blob_id: nil) }

  # SSoT: Store content with deduplication via StorageBlob
  # Same file = same blob, just increment reference count
  #
  # Usage:
  #   attachment.store_content!(file_content, filename: "invoice.pdf")
  #
  def store_content!(content, filename: nil, content_type: nil)
    # Compute hash for deduplication
    hash = self.class.compute_hash(content)

    # Update our content_hash
    self.content_hash = hash
    self.filename ||= filename

    # Find or create deduplicated blob
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    # Link to blob and increment reference
    old_blob = storage_blob
    self.storage_blob = blob
    save!

    # Increment new blob reference
    blob.increment_reference!

    # Decrement old blob reference if we had one
    old_blob&.decrement_reference!

    blob
  end

  # Get storage path (from blob or legacy sharepoint_path)
  def storage_path
    storage_blob&.storage_path || sharepoint_path
  end

  # Check if file is stored
  def stored?
    storage_blob_id.present? || sharepoint_path.present?
  end

  # Download file content
  def download
    return storage_blob.download if storage_blob.present?

    # Legacy: Download from SharePoint path
    nil
  end

  # Check if this attachment matches an existing company document by content hash
  def find_matching_document
    return nil if content_hash.blank?

    CorporateCompanyDocument.find_by(content_hash: content_hash)
  end

  # Calculate content hash from binary data
  def self.compute_hash(content)
    Digest::SHA256.hexdigest(content)
  end

  # SSoT: storage_blob is THE ONE storage reference for email attachments
  # This model doesn't use sharepoint_file_id pattern, it uses:
  # - storage_blob (new SSoT, deduplicated)
  # - sharepoint_path (legacy, path string not item ID)
  def storage_reference
    storage_blob_id.presence
  end
end
