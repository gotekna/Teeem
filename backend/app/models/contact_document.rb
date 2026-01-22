# frozen_string_literal: true

# ContactDocument - Documents attached to contacts
#
# SSoT Integration:
# - Includes StorableDocument for Wasabi storage
# - Storage path: /Contacts/{{ContactName}}/{{TabName}}/filename
# - document_type determines folder (via primary_tab) and filename (via file_name template)
#
class ContactDocument < ApplicationRecord
  include StorableDocument
  include DocumentStorageConstants

  # SSoT: Storage scope for this document type
  # Determines path: /Contacts/{ContactName}/{TabName}/filename
  storage_scope :contact

  # Associations
  belongs_to :contact
  belongs_to :document_type, optional: true
  belongs_to :uploaded_by, class_name: "User", optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  # Same file = same StorageBlob, deduplication via content_hash
  belongs_to :storage_blob, optional: true

  # ActiveStorage has_one_attached :file was REMOVED (Jan 2026) - it violated SSoT by
  # duplicating storage location. Files now stored via StorageBlob (belongs_to :storage_blob)
  # which deduplicates via content_hash and uses StorageConfiguration for provider-agnostic paths.

  # Phase 3: Universal warehouse metadata (SSoT for display_name, send_name, folder)
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # SSoT: STORAGE_PROVIDERS, MIGRATION_STATUSES defined in DocumentStorageConstants concern

  # Validations
  validates :file_name, presence: true
  validates :contact_id, presence: true
  validates :storage_provider, inclusion: { in: STORAGE_PROVIDERS }, allow_nil: true
  validates :migration_status, inclusion: { in: MIGRATION_STATUSES }, allow_nil: true

  # Scopes
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
  scope :by_folder, ->(folder) { where(folder: folder) }
  scope :recent, -> { order(created_at: :desc) }

  # Migration scopes (from StorableDocument)
  scope :on_provider, ->(provider) { where(storage_provider: provider) }

  # Callbacks
  before_save :set_file_extension

  # Instance methods
  def display_name
    file_name
  end

  def file_size_mb
    return nil unless file_size.present?

    (file_size.to_f / 1024 / 1024).round(2)
  end

  # SSoT: storage_reference is now defined in StorableDocument concern

  # SSoT: Get the EntityTab from DocumentType (primary_entity_tab method)
  # This provides the folder name and storage_folder_path template
  def effective_entity_tab
    document_type&.primary_entity_tab
  end

  # SSoT: Get the storage folder path template from EntityTab
  # This is the database-stored template, NOT a hardcoded constant
  def storage_folder_template
    effective_entity_tab&.storage_folder_path
  end

  # ========================================
  # StorageBlob File Access (SSoT)
  # ========================================

  # Check if document has an attached file
  def has_file?
    storage_blob_id.present?
  end

  # Get presigned download URL for the file
  # @param expires_in [Integer] Expiry time in seconds (default: 3600)
  # @return [String, nil] Presigned download URL or nil if no file
  def file_url(expires_in: 3600)
    return nil unless storage_blob

    storage_blob.presigned_url(expires_in: expires_in, filename: file_name)
  end

  # Download file content from storage
  # @return [String, nil] File content or nil if no file
  def download_file
    return nil unless storage_blob

    storage_blob.download
  end

  # Attach a file using StorageBlob (deduplication via content_hash)
  # @param content [String] File content
  # @param filename [String] Original filename
  # @param content_type [String] MIME type (optional)
  def attach_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    # Update reference counts
    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!

    # Update document metadata
    self.file_name = filename
    self.file_size = content.bytesize
    self.content_type = content_type || blob.content_type
  end

  # Phase 4: Virtual folder path for File Warehouse
  # SSoT: Reads template from StorageConfiguration.virtual_template_for(:contact)
  # No fallback - if template is nil, that's a config error that should be fixed
  def virtual_folder_path
    config = StorageConfiguration.instance
    template = config&.virtual_template_for(:contact)
    raise "StorageConfiguration missing :contact template - run rails warehouse:init" unless template

    tokens = default_storage_tokens
    result = template.dup
    result.gsub!("{{ContactName}}", tokens[:ContactName].to_s)
    result.gsub!("{{ContactId}}", contact&.id.to_s)
    result.gsub!("{{TabName}}", tokens[:TabName].to_s)
    result.gsub!("{{Category}}", folder.to_s)
    result.gsub!("{{Folder}}", folder.to_s)

    # Clean up empty tokens and extra slashes
    result.gsub!(/\{\{[^}]+\}\}/, "")
    result.gsub!(%r{//+}, "/")
    result.gsub!(%r{^/|/$}, "")
    result
  end

  private

  # SSoT: Default tokens for storage path template
  # Path is built from:
  # 1. EntityTab.storage_folder_path template (from database, NOT hardcoded)
  # 2. Tokens expanded from this method
  def default_storage_tokens
    entity_tab = effective_entity_tab

    {
      # Contact tokens
      ContactName: sanitize_path_component(contact&.display_name || "Unknown"),

      # Tab tokens (from EntityTab - SSoT for folder structure)
      TabName: entity_tab&.display_name || folder || document_type&.primary_tab || "Documents",
      TabKey: entity_tab&.tab_key,
      SubTabName: entity_tab&.parent&.display_name,

      # DocumentType tokens
      DocTypeCode: document_type&.abbreviation,
      DocTypeName: document_type&.name,
      Folder: document_type&.folder,

      # Date tokens
      Date: created_at&.strftime("%Y-%m-%d"),

      # File tokens
      OriginalFileName: File.basename(file_name.to_s, ".*")
    }.compact
  end

  def set_file_extension
    return if file_name.blank?

    self.file_extension ||= File.extname(file_name).delete(".")
  end

  # Sanitize path component to be filesystem-safe
  def sanitize_path_component(name)
    return nil if name.blank?

    name.gsub(/[<>:"|?*\\\/]/, "-").strip
  end
end
