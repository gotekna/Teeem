# frozen_string_literal: true

# SmTaskPhoto - Photos attached to SM tasks for field documentation
#
# Used for:
# - Task completion photos (before/after)
# - Progress documentation
# - Issue reporting
# - Quality verification
#
class SmTaskPhoto < ApplicationRecord
  belongs_to :task, class_name: 'SmTask', foreign_key: 'sm_task_id'
  belongs_to :uploaded_by, class_name: 'User', optional: true
  belongs_to :resource, class_name: 'SmResource', optional: true

  # Photo types
  PHOTO_TYPES = %w[completion progress issue before after general].freeze

  validates :photo_url, presence: true
  validates :photo_type, inclusion: { in: PHOTO_TYPES }, allow_nil: true

  # Scopes
  scope :completion_photos, -> { where(photo_type: 'completion') }
  scope :progress_photos, -> { where(photo_type: 'progress') }
  scope :issue_photos, -> { where(photo_type: 'issue') }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_date, ->(date) { where(taken_at: date.beginning_of_day..date.end_of_day) }

  # Callbacks
  before_create :set_taken_at

  # Instance methods
  def thumbnail_url
    return nil unless photo_url

    # If using Cloudinary, generate thumbnail transformation
    if photo_url.include?('cloudinary')
      photo_url.gsub('/upload/', '/upload/c_thumb,w_200,h_200/')
    else
      photo_url
    end
  end

  def medium_url
    return nil unless photo_url

    if photo_url.include?('cloudinary')
      photo_url.gsub('/upload/', '/upload/c_limit,w_800,h_800/')
    else
      photo_url
    end
  end

  private

  def set_taken_at
    self.taken_at ||= Time.current
  end
end
