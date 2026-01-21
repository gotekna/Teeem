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
  warehouse_type :file

  # Associations
  belongs_to :page, class_name: "NotebookPage"
  belongs_to :uploaded_by, class_name: "User", optional: true

  has_one :section, through: :page
  has_one :notebook, through: :section

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  # ActiveStorage has_one_attached :file was REMOVED (Jan 2026) - it violated SSoT.

  # Validations
  validates :file_name, presence: true, length: { maximum: 255 }
  validates :storage_key, presence: true, uniqueness: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(content_type: type) }
  scope :images, -> { where("content_type LIKE ?", "image/%") }
  scope :documents, -> { where("content_type NOT LIKE ?", "image/%") }

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

  # Download file content from storage
  def download_file
    return nil unless storage_blob

    storage_blob.download
  end

  # Attach a file using StorageBlob
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
end
