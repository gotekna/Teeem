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

  # SSoT: Default storage scope (overridden by effective_storage_scope)
  storage_scope :users

  # Associations
  belongs_to :user
  belongs_to :document_type, optional: true

  # Active Storage for file upload
  has_one_attached :file

  # SSoT: Categories map to storage scopes in StorageConfiguration
  CATEGORIES = {
    "photos" => :user_photos,      # /Users/Photos/
    "contracts" => :user_contracts, # /Users/Contracts/
    "my_docs" => :my_docs          # /Users/MyDocs/
  }.freeze

  # Storage providers (SSoT: derived from active credential)
  STORAGE_PROVIDERS = %w[sharepoint wasabi s3 local].freeze

  # Migration statuses for tracking provider-to-provider migration
  MIGRATION_STATUSES = %w[pending in_progress completed failed].freeze

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

  # SSoT: Map category to storage scope from StorageConfiguration
  # This determines which folder path is used
  def effective_storage_scope
    CATEGORIES[category] || :users
  end

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

  private

  # SSoT: Default tokens for storage path template
  # Path is built from:
  # 1. EntityTab.storage_folder_path template (from database, NOT hardcoded)
  # 2. Tokens expanded from this method
  #
  # Category determines base folder:
  # - photos: /Users/Photos/{UserName}/filename
  # - contracts: /Users/Contracts/{UserName}/filename
  # - my_docs: /Users/MyDocs/{UserName}/filename
  def default_storage_tokens
    entity_tab = effective_entity_tab

    {
      # User tokens
      UserName: sanitize_path_component(user&.name || "Unknown"),
      UserEmail: user&.email,

      # Tab tokens (from EntityTab - SSoT for folder structure)
      TabName: entity_tab&.display_name || folder || category&.titleize || "Documents",
      TabKey: entity_tab&.tab_key,
      SubTabName: entity_tab&.parent&.display_name,

      # DocumentType tokens
      DocTypeCode: document_type&.code,
      DocTypeName: document_type&.name,
      Folder: document_type&.folder,

      # Category token
      Category: category&.titleize,

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
