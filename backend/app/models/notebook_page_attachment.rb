# frozen_string_literal: true

# NotebookPageAttachment - File attachments on notebook pages
#
# Features:
# - Stores file metadata
# - Links to storage (ActiveStorage or SharePoint)
# - Tracks uploader
#
class NotebookPageAttachment < ApplicationRecord
  # Associations
  belongs_to :page, class_name: "NotebookPage"
  belongs_to :uploaded_by, class_name: "User", optional: true

  has_one :section, through: :page
  has_one :notebook, through: :section

  # ActiveStorage file attachment
  has_one_attached :file

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
  # Warehouse Path (for File Warehouse storage)
  # ========================================

  # Compute the warehouse path for this attachment
  # SSoT: Uses StorageConfiguration for base path and template
  #
  # Example: "Warehousing/Notes/Robert Harder/2026/report.pdf"
  #
  def warehouse_path
    config = StorageConfiguration.instance
    base = config.path_for(:notes)
    template = config.template_for(:notes)

    # Resolve template placeholders
    resolved = resolve_template(template, {
      "UserName" => uploaded_by&.display_name || "Unknown",
      "Year" => created_at&.year&.to_s || Time.current.year.to_s,
      "Month" => created_at&.strftime("%m") || Time.current.strftime("%m")
    })

    # Combine: base/template/filename
    "#{base}/#{resolved}/#{file_name}".gsub(%r{/+}, "/")
  end

  # Folder path (without filename)
  def warehouse_folder_path
    config = StorageConfiguration.instance
    base = config.path_for(:notes)
    template = config.template_for(:notes)

    resolved = resolve_template(template, {
      "UserName" => uploaded_by&.display_name || "Unknown",
      "Year" => created_at&.year&.to_s || Time.current.year.to_s,
      "Month" => created_at&.strftime("%m") || Time.current.strftime("%m")
    })

    "#{base}/#{resolved}".gsub(%r{/+}, "/")
  end

  private

  def resolve_template(template, values)
    result = template.dup
    values.each { |key, value| result.gsub!("{{#{key}}}", value.to_s) }
    result
  end
end
