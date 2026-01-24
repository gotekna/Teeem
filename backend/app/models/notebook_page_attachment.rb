# frozen_string_literal: true

# NotebookPageAttachment - File attachments on notebook pages
#
# Features:
# - Stores file metadata
# - Links to storage (ActiveStorage or SharePoint)
# - Tracks uploader
#
class NotebookPageAttachment < ApplicationRecord
  include WarehouseSyncable
  include BlobStorable  # SSoT: provides download_file, has_file?, base attach_file
  warehouse_type :file

  # Associations
  belongs_to :page, class_name: "NotebookPage"
  belongs_to :uploaded_by, class_name: "User", optional: true

  has_one :section, through: :page
  has_one :notebook, through: :section

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  # Phase 4: Universal warehouse metadata (SSoT for display_name, folder)
  # Notebook attachments appear under Warehousing/Notes folder in File Warehouse
  has_one :warehouse_document, as: :documentable, dependent: :destroy

  # ActiveStorage has_one_attached :file was REMOVED (Jan 2026) - it violated SSoT.

  # Validations
  validates :file_name, presence: true, length: { maximum: 255 }
  validates :storage_key, presence: true, uniqueness: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(content_type: type) }
  scope :images, -> { where("content_type LIKE ?", "image/%") }
  scope :documents, -> { where("content_type NOT LIKE ?", "image/%") }

  # Callbacks
  after_create :create_warehouse_entry

  # Check if image
  def image?
    content_type&.start_with?("image/")
  end

  # Human-readable file size
  def human_size
    return "0 B" if file_size.nil? || file_size.zero?

    units = %w[B KB MB GB]
    size = file_size.to_f
    unit_index = 0

    while size >= 1024 && unit_index < units.length - 1
      size /= 1024
      unit_index += 1
    end

    "#{size.round(1)} #{units[unit_index]}"
  end

  # File extension
  def extension
    File.extname(file_name).delete_prefix(".")
  end

  # ========================================
  # Warehouse Path (SSoT: StorageConfiguration)
  # ========================================

  # SSoT: Full warehouse path including filename
  # Include ID to prevent collisions when multiple attachments have the same name
  # Example: "Warehousing/Notes/Robert Harder/2026/report_123.pdf"
  def warehouse_path
    ext = File.extname(file_name)
    base = File.basename(file_name, ext)
    "#{warehouse_folder_path}/#{base}_#{id}#{ext}".gsub(%r{/+}, "/")
  end

  # SSoT: Folder path computed by StorageConfiguration
  def warehouse_folder_path
    StorageConfiguration.instance.resolve_warehouse_path(self, scope: :notes)
  end

  # Phase 4: Virtual folder path for File Warehouse
  # SSoT: Reads from StorageConfiguration.virtual_template_for(:notebook)
  # Configure at: /settings/company/entity-config → Storage Config
  def virtual_folder_path
    config = StorageConfiguration.instance
    template = config&.virtual_template_for(:notebook)
    return "Warehousing/Notes/Unknown" unless template

    year = (created_at || Time.current).year.to_s
    notebook_name = notebook&.name || "General"
    user_name = uploaded_by&.name || "Unknown"

    result = template.dup
    result.gsub!("{{UserName}}", user_name)
    result.gsub!("{{NotebookName}}", notebook_name)
    result.gsub!("{{Year}}", year)
    result.gsub!(/\{\{[^}]+\}\}/, "")
    result.gsub!(%r{//+}, "/")
    result
  end

  # ========================================
  # StorageBlob File Access (SSoT)
  # ========================================

  # Check if attachment has a file
  def has_file?
    storage_blob_id.present?
  end

  # Get presigned download URL for the file
  def file_url(expires_in: 3600)
    return nil unless storage_blob

    storage_blob.presigned_url(expires_in: expires_in, filename: file_name)
  end

  # download_file is provided by BlobStorable concern (SSoT)

  # Override BlobStorable#attach_file to set model-specific metadata
  def attach_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!

    self.file_name = filename
    self.file_size = content.bytesize
    self.content_type = content_type || blob.content_type
  end

  private

  # Create WarehouseDocument entry for notebook attachments
  def create_warehouse_entry
    return unless storage_blob

    create_warehouse_document!(
      source_type: "warehouse",
      folder: virtual_folder_path,
      display_name: file_name,
      original_filename: file_name,
      storage_blob: storage_blob,
      metadata: {
        notebook_page_attachment_id: id,
        notebook_id: notebook&.id,
        notebook_name: notebook&.name,
        page_id: page&.id,
        uploaded_by_id: uploaded_by_id
      }
    )
  rescue StandardError => e
    Rails.logger.error("[NotebookPageAttachment] Failed to create warehouse entry: #{e.message}")
  end
end
