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

  # Active Storage for file upload
  has_one_attached :file

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

  # Provider-agnostic storage helpers
  def storage_reference
    storage_item_id.presence || sharepoint_item_id
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
      DocTypeCode: document_type&.code,
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
