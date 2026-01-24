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
  # Storage path (provider-agnostic, renamed from sharepoint_path)
  scope :synced_to_storage, -> { where.not(storage_path: nil) }
  scope :synced_to_sharepoint, -> { where.not(storage_path: nil) }  # Legacy alias
  scope :pending_sync, -> { where(storage_path: nil, storage_blob_id: nil) }

  # Callbacks
  after_create :create_warehouse_entry

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

  # SSoT: StorageBlob is THE ONE source for file paths
  def effective_storage_path
    storage_blob&.storage_path
  end

  # Check if file is stored via StorageBlob (SSoT)
  def stored?
    storage_blob_id.present?
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
  # This model doesn't use file_id pattern, it uses:
  # - storage_blob (new SSoT, deduplicated)
  # - storage_path (path string, renamed from sharepoint_path)
  def storage_reference
    storage_blob_id.presence
  end

  # Phase 4: Virtual folder path for File Warehouse
  # SSoT: Use same template as parent email (:email scope)
  # This ensures attachments appear in same folder as their parent email
  # Configure at: /settings/company/entity-config → Storage Config → Emails
  def virtual_folder_path
    email = synced_email
    unless email
      # SSoT: Uses StorageConfiguration for base folder (Jan 2026)
      emails_folder = StorageConfiguration.instance&.path_for(:emails) || "Emails"
      return "#{emails_folder}/Unknown"
    end

    # SSoT: Use parent email's folder - attachments appear alongside .eml files
    email.virtual_folder_path
  end

  private

  # Create WarehouseDocument entry for File Warehouse
  def create_warehouse_entry
    return unless storage_blob

    create_warehouse_document!(
      source_type: "email_attachment",
      folder: virtual_folder_path,
      display_name: filename || "Attachment",
      original_filename: filename,
      storage_blob: storage_blob,
      metadata: {
        email_attachment_id: id,
        synced_email_id: email_warehouse_id,
        content_hash: content_hash
      }
    )
  rescue StandardError => e
    Rails.logger.error("[EmailAttachment] Failed to create warehouse entry for #{id}: #{e.message}")
  end
end
