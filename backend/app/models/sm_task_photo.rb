# frozen_string_literal: true

# SmTaskPhoto - Photos attached to SM tasks for field documentation
#
# Used for:
# - Task completion photos (before/after)
# - Progress documentation
# - Issue reporting
# - Quality verification
# - Site presence check-in/checkout photos (face verification)
#
# Part of Site Presence & Cost Intelligence System
#
# SSoT Integration:
# - Includes StorableDocument for Wasabi storage
# - document_type determines folder (via primary_tab) and filename (via file_name template)
# - Falls back to task.completion_document_type if document_type not set directly
#
class SmTaskPhoto < ApplicationRecord
  include StorableDocument
  storage_scope :job  # Photos go in job folders: /Jobs/{{JobCode}}/{{TabName}}/

  # Associations
  belongs_to :task, class_name: "SmTask", foreign_key: "sm_task_id", optional: true
  belongs_to :job, optional: true
  belongs_to :uploaded_by, class_name: "User", optional: true
  belongs_to :resource, class_name: "SmResource", optional: true
  belongs_to :document_type, optional: true  # SSoT: determines folder + filename

  # Site presence associations
  has_one :checkin_session, class_name: "SitePresenceSession", foreign_key: "checkin_photo_id"
  has_one :checkout_session, class_name: "SitePresenceSession", foreign_key: "checkout_photo_id"

  # Photo types (extended for site presence)
  PHOTO_TYPES = %w[completion progress issue before after general checkin checkout].freeze

  validates :photo_url, presence: true
  validates :photo_type, inclusion: { in: PHOTO_TYPES }, allow_nil: true
  validate :has_task_or_job

  # Scopes
  scope :completion_photos, -> { where(photo_type: "completion") }
  scope :progress_photos, -> { where(photo_type: "progress") }
  scope :issue_photos, -> { where(photo_type: "issue") }
  scope :checkin_photos, -> { where(is_checkin_photo: true) }
  scope :checkout_photos, -> { where(is_checkout_photo: true) }
  scope :site_presence_photos, -> { where("is_checkin_photo = true OR is_checkout_photo = true") }
  scope :face_verified, -> { where(face_verified: true) }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_date, ->(date) { where(taken_at: date.beginning_of_day..date.end_of_day) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }

  # Callbacks
  before_create :set_taken_at

  # Instance methods
  def thumbnail_url
    return nil unless photo_url

    # If using Cloudinary, generate thumbnail transformation
    if photo_url.include?("cloudinary")
      photo_url.gsub("/upload/", "/upload/c_thumb,w_200,h_200/")
    else
      photo_url
    end
  end

  def medium_url
    return nil unless photo_url

    if photo_url.include?("cloudinary")
      photo_url.gsub("/upload/", "/upload/c_limit,w_800,h_800/")
    else
      photo_url
    end
  end

  # Site presence helpers
  def checkin_photo?
    is_checkin_photo || photo_type == "checkin"
  end

  def checkout_photo?
    is_checkout_photo || photo_type == "checkout"
  end

  def site_presence_photo?
    checkin_photo? || checkout_photo?
  end

  # GPS helpers
  def has_gps?
    (latitude.present? && longitude.present?) ||
      (exif_latitude.present? && exif_longitude.present?)
  end

  def effective_latitude
    latitude || exif_latitude
  end

  def effective_longitude
    longitude || exif_longitude
  end

  # ========================================
  # SSoT Storage Integration
  # ========================================

  # SSoT: Get document_type from task.completion_document_type if not set directly
  def effective_document_type
    document_type || task&.completion_document_type
  end

  # SSoT: Get the WarehouseFolder from DocumentType (primary_warehouse_folder method)
  # This provides the folder name and storage_folder_path template
  def effective_warehouse_folder
    effective_document_type&.primary_warehouse_folder
  end

  # DEPRECATED: Use effective_warehouse_folder (Jan 2026)
  alias_method :effective_entity_tab, :effective_warehouse_folder

  # SSoT: All tokens come from related records - NOTHING HARDCODED
  # Used by StorableDocument.upload_to_storage() to build the storage path
  #
  # Path is built from:
  # 1. WarehouseFolder.storage_folder_path template (from database, NOT hardcoded)
  # 2. Tokens expanded from this method
  def default_storage_tokens
    doc_type = effective_document_type
    warehouse_folder = effective_warehouse_folder
    effective_job = job || task&.job

    {
      # Job tokens
      JobCode: effective_job&.job_code,
      JobTitle: effective_job&.title,

      # Tab tokens (from WarehouseFolder - SSoT for folder structure)
      TabName: warehouse_folder&.display_name || doc_type&.primary_tab,
      TabKey: warehouse_folder&.tab_key,
      SubTabName: warehouse_folder&.parent&.display_name,

      # DocumentType tokens
      DocTypeCode: doc_type&.code || doc_type&.abbreviation,
      DocTypeName: doc_type&.name,
      Folder: doc_type&.folder,

      # Date/time tokens
      Date: (taken_at || created_at)&.strftime("%Y-%m-%d"),
      DateTime: (taken_at || created_at)&.strftime("%Y-%m-%d_%H%M%S"),

      # File tokens
      OriginalFileName: File.basename(photo_url.to_s, ".*")
    }.compact
  end

  # SSoT: Get the storage folder path template from WarehouseFolder
  # This is the database-stored template, NOT a hardcoded constant
  def storage_folder_template
    effective_warehouse_folder&.storage_folder_path
  end

  # SSoT: Filename from DocumentType.file_name template
  # Falls back to "{DocTypeCode} {JobCode} {Date}" if no template
  def storage_filename
    doc_type = effective_document_type
    tokens = default_storage_tokens

    base_name = if doc_type&.file_name.present?
      expand_filename_template(doc_type.file_name, tokens)
    else
      # Fallback: use tokens directly
      [tokens[:DocTypeCode], tokens[:JobCode], tokens[:Date]].compact.join(" ")
    end

    ext = File.extname(photo_url.to_s).presence || ".jpg"
    "#{base_name}#{ext}"
  end

  private

  def set_taken_at
    self.taken_at ||= Time.current
  end

  def has_task_or_job
    return if sm_task_id.present? || job_id.present?

    errors.add(:base, "Must belong to either a task or a job")
  end

  # Expand {Token} placeholders in filename template
  def expand_filename_template(template, tokens)
    result = template.dup
    tokens.each { |key, value| result.gsub!("{#{key}}", value.to_s) }
    result.gsub(/\{[^}]+\}/, "") # Remove unexpanded tokens
  end
end
