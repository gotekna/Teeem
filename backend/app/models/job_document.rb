class JobDocument < ApplicationRecord
  belongs_to :job
  belongs_to :document_type, optional: true
  belongs_to :ai_suggested_type, class_name: 'DocumentType', optional: true
  belongs_to :rename_approved_by, class_name: 'User', optional: true

  # File type enum based on extension
  FILE_TYPE_MAP = {
    'rvt' => 'revit_project',
    'rfa' => 'revit_family',
    'dwg' => 'autocad',
    'dxf' => 'autocad_export',
    'dwfx' => 'design_web',
    'pdf' => 'pdf',
    'jpg' => 'image',
    'jpeg' => 'image',
    'png' => 'image',
    'heic' => 'image',
    'xlsx' => 'spreadsheet',
    'xls' => 'spreadsheet',
    'docx' => 'document',
    'doc' => 'document'
  }.freeze

  # Sync status enum
  SYNC_STATUSES = %w[pending synced missing error].freeze

  validates :onedrive_item_id, presence: true, uniqueness: true
  validates :file_name, presence: true
  validates :sync_status, inclusion: { in: SYNC_STATUSES }

  # Scopes
  scope :cad_files, -> { where(file_type: %w[revit_project revit_family autocad autocad_export design_web]) }
  scope :documents, -> { where(file_type: %w[pdf document]) }
  scope :images, -> { where(file_type: 'image') }
  scope :spreadsheets, -> { where(file_type: 'spreadsheet') }
  scope :in_folder, ->(folder) { where('folder_path LIKE ?', "%#{folder}%") }
  scope :synced, -> { where(sync_status: 'synced') }
  scope :needs_sync, -> { where(sync_status: %w[pending error]) }

  # Callbacks
  before_save :set_file_extension
  before_save :set_file_type
  before_save :auto_detect_document_type

  # Determine file type from extension
  def self.file_type_for(extension)
    ext = extension.to_s.downcase.delete_prefix('.')
    FILE_TYPE_MAP[ext] || 'other'
  end

  # Detect document type based on file extension
  def detect_document_type
    return nil if file_extension.blank?

    ext = ".#{file_extension.downcase}"
    DocumentType.where(scope: %w[job both])
                .where("? = ANY(file_extensions)", ext)
                .first
  end

  # Check if this is a CAD/BIM file
  def cad_file?
    %w[revit_project revit_family autocad autocad_export design_web].include?(file_type)
  end

  # Format file size for display
  def formatted_size
    return nil unless file_size

    if file_size >= 1.gigabyte
      "#{(file_size.to_f / 1.gigabyte).round(2)} GB"
    elsif file_size >= 1.megabyte
      "#{(file_size.to_f / 1.megabyte).round(1)} MB"
    elsif file_size >= 1.kilobyte
      "#{(file_size.to_f / 1.kilobyte).round(0)} KB"
    else
      "#{file_size} B"
    end
  end

  private

  def set_file_extension
    return if file_extension.present? || file_name.blank?

    self.file_extension = File.extname(file_name).delete_prefix('.').downcase
  end

  def set_file_type
    return if file_type.present?

    self.file_type = self.class.file_type_for(file_extension)
  end

  def auto_detect_document_type
    return if document_type_id.present?

    detected = detect_document_type
    self.document_type = detected if detected
  end
end
