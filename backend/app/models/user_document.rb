# frozen_string_literal: true

# UserDocument - Documents attached to users (photos, contracts, personal docs)
#
# SSoT Integration:
# - Includes StorableDocument for Wasabi storage
# - Category determines the storage scope:
#   - photos → :user_photos → /Users/Photos/{{UserName}}/filename
#   - contracts → :user_contracts → /Users/Contracts/{{UserName}}/filename
#   - my_docs → :my_docs → /Users/MyDocs/{{UserName}}/filename
#
class UserDocument < ApplicationRecord
  include StorableDocument
  include DocumentStorageConstants

  # SSoT: Default storage scope (overridden by effective_storage_scope)
  storage_scope :users

  # Associations
  belongs_to :user
  belongs_to :document_type, optional: true

  # SSoT: Link to deduplicated file storage (Jan 2026)
  # Same file = same StorageBlob, deduplication via content_hash
  belongs_to :storage_blob, optional: true

  # ActiveStorage has_one_attached :file was REMOVED (Jan 2026) - it violated SSoT by
  # duplicating storage location. Files now stored via StorageBlob (belongs_to :storage_blob)
  # which deduplicates via content_hash and uses WarehouseProvider for provider-agnostic paths.

  # Phase 3: Universal warehouse metadata (SSoT for ui_name, download_name, folder)
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # SSoT: Categories map to storage scopes in WarehouseProvider
  CATEGORIES = {
    "photos" => :user_photos,      # /Users/Photos/
    "contracts" => :user_contracts, # /Users/Contracts/
    "my_docs" => :my_docs          # /Users/MyDocs/
  }.freeze

  # SSoT: STORAGE_PROVIDERS, MIGRATION_STATUSES defined in DocumentStorageConstants concern

  # Validations
  validates :file_name, presence: true
  validates :user_id, presence: true
  validates :category, inclusion: { in: CATEGORIES.keys }, allow_nil: true
  validates :storage_provider, inclusion: { in: STORAGE_PROVIDERS }, allow_nil: true
  validates :migration_status, inclusion: { in: MIGRATION_STATUSES }, allow_nil: true

  # Scopes
  scope :for_user, ->(user_id) { where(user_id: user_id) }
  scope :by_category, ->(category) { where(category: category) }
  scope :photos, -> { where(category: "photos") }
  scope :contracts, -> { where(category: "contracts") }
  scope :my_docs, -> { where(category: "my_docs") }
  scope :recent, -> { order(created_at: :desc) }

  # Migration scopes
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

  # SSoT: Map category to storage scope from WarehouseProvider
  # This determines which folder path is used
  def effective_storage_scope
    CATEGORIES[category] || :users
  end

  # SSoT: Get the WarehouseFolder from DocumentType (primary_warehouse_folder method)
  # This provides the folder name and storage_folder_path template
  def effective_warehouse_folder
    document_type&.primary_warehouse_folder
  end

  # DEPRECATED: Use effective_warehouse_folder (Jan 2026)
  alias_method :effective_entity_tab, :effective_warehouse_folder

  # SSoT: Get the storage folder path template from WarehouseFolder
  # This is the database-stored template, NOT a hardcoded constant
  def storage_folder_template
    effective_warehouse_folder&.storage_folder_path
  end

  # ========================================
  # Phase 4: Virtual File Warehouse (SSoT)
  # ========================================

  # SSoT: Virtual folder path for File Warehouse display
  # Uses WarehouseProvider template from database (e.g., "Teeem Docs/{{UserName}}/{{Year}}")
  #
  # @return [String] Virtual folder path like "Teeem Docs/Robert Harder/2026"
  def virtual_folder_path
    config = WarehouseProvider.instance
    template = config&.path_for(:user)
    raise "WarehouseProvider missing :user template - run rails warehouse:init" unless template

    result = template.dup

    # User-related tokens (use "Unknown" fallback for nil/blank user names)
    result.gsub!("{{UserName}}", sanitize_path_component(user&.name.to_s) || "Unknown")

    # Date tokens (SSoT: based on document creation date)
    doc_date = created_at || Time.current
    result.gsub!("{{Year}}", doc_date.year.to_s)
    result.gsub!("{{Month}}", doc_date.strftime("%m"))
    result.gsub!("{{Day}}", doc_date.strftime("%d"))

    # Folder/category tokens
    result.gsub!("{{Folder}}", folder.to_s)
    result.gsub!("{{Category}}", category&.titleize.to_s)
    result.gsub!("{{TabName}}", folder.to_s.presence || category&.titleize.to_s)

    # File-related tokens
    result.gsub!("{{OriginalFileName}}", sanitize_path_component(File.basename(file_name.to_s, ".*")) || "")

    # Clean up empty tokens and double slashes
    result.gsub!(/\{\{[^}]+\}\}/, "")
    result.gsub!(%r{//+}, "/")
    result.gsub!(%r{^/|/$}, "")
    result
  end

  # Override upload_to_storage to use dynamic scope
  def upload_to_storage(file_content, tokens: {}, filename: nil)
    # Temporarily set the storage scope based on category
    original_scope = self.class.document_storage_scope
    self.class.storage_scope(effective_storage_scope)

    result = super

    # Restore original scope
    self.class.storage_scope(original_scope)

    result
  end

  # ========================================
  # StorageBlob File Access (SSoT)
  # ========================================

  # has_file? is provided by StorableDocument concern (SSoT)

  # file_url is provided by StorableDocument concern (SSoT)

  # download_file is provided by StorableDocument concern (SSoT)

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

  private

  # SSoT: Default tokens for storage path template
  # Path is built from:
  # 1. WarehouseFolder.storage_folder_path template (from database, NOT hardcoded)
  # 2. Tokens expanded from this method
  #
  # Category determines base folder:
  # - photos: /Users/Photos/{UserName}/filename
  # - contracts: /Users/Contracts/{UserName}/filename
  # - my_docs: /Users/MyDocs/{UserName}/filename
  def default_storage_tokens
    warehouse_folder = effective_warehouse_folder
    doc_date = created_at || Time.current

    {
      # User tokens
      UserName: sanitize_path_component(user&.name || "Unknown"),
      UserEmail: user&.email,

      # Tab tokens (from WarehouseFolder - SSoT for folder structure)
      TabName: warehouse_folder&.display_name || folder || category&.titleize || "Documents",
      TabKey: warehouse_folder&.tab_key,
      SubTabName: warehouse_folder&.parent&.display_name,

      # DocumentType tokens
      DocTypeCode: document_type&.code,
      DocTypeName: document_type&.name,
      Folder: document_type&.folder,

      # Category token
      Category: category&.titleize,

      # Date tokens (SSoT: for folder organization)
      Date: doc_date.strftime("%Y-%m-%d"),
      Year: doc_date.year.to_s,
      Month: doc_date.strftime("%m"),
      Day: doc_date.strftime("%d"),

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
