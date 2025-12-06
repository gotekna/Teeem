class TaskUpdate < ApplicationRecord
  belongs_to :project_task
  belongs_to :user

  validates :update_date, presence: true

  scope :recent, -> { order(created_at: :desc) }
  scope :for_date, ->(date) { where(update_date: date) }
  scope :with_status_changes, -> { where.not(status_before: nil).or(where.not(status_after: nil)) }
  scope :with_progress_changes, -> { where.not(progress_before: nil).or(where.not(progress_after: nil)) }

  def status_changed?
    status_before.present? && status_after.present? && status_before != status_after
  end

  def progress_changed?
    progress_before.present? && progress_after.present? && progress_before != progress_after
  end

  def has_photos?
    photo_urls.present? && photo_urls.any?
  end

  def summary
    parts = []
    parts << "Status: #{status_before} → #{status_after}" if status_changed?
    parts << "Progress: #{progress_before}% → #{progress_after}%" if progress_changed?
    parts << "Photos: #{photo_urls.count}" if has_photos?
    parts.join(", ")
  end
end
