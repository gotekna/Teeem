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

  # SSoT: Storage scope for this document type
  # Determines path: /Contacts/{ContactName}/{TabName}/filename
  storage_scope :contact

  # Associations
  belongs_to :contact
  belongs_to :document_type, optional: true
  belongs_to :uploaded_by, class_name: "User", optional: true

  # Active Storage for file upload
  has_one_attached :file

  # Storage providers (SSoT: derived from active credential)
  STORAGE_PROVIDERS = %w[sharepoint wasabi s3 local].freeze

  # Migration statuses for tracking provider-to-provider migration
  MIGRATION_STATUSES = %w[pending in_progress completed failed].freeze

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

  private

  # SSoT: Default tokens for storage path template
  # Template: /Contacts/{ContactName}/{TabName}/filename
  def default_storage_tokens
    {
      ContactName: sanitize_path_component(contact&.display_name || "Unknown"),
      TabName: folder || document_type&.primary_tab&.display_name || "Documents",
      DocTypeCode: document_type&.code,
      Date: created_at&.strftime("%Y-%m-%d")
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
