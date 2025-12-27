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
class SmTaskPhoto < ApplicationRecord
  # Associations
  belongs_to :task, class_name: "SmTask", foreign_key: "sm_task_id", optional: true
  belongs_to :job, optional: true
  belongs_to :uploaded_by, class_name: "User", optional: true
  belongs_to :resource, class_name: "SmResource", optional: true

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

  private

  def set_taken_at
    self.taken_at ||= Time.current
  end

  def has_task_or_job
    return if sm_task_id.present? || job_id.present?

    errors.add(:base, "Must belong to either a task or a job")
  end
end
