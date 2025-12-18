# Revision history for job plans
# Tracks each revision with SharePoint file links
class JobPlanRevision < ApplicationRecord
  belongs_to :job_plan
  belongs_to :issued_by, class_name: 'User', optional: true

  validates :revision, presence: true
  validates :revision, uniqueness: { scope: :job_plan_id }

  scope :ordered, -> { order(revision_date: :desc, created_at: :desc) }
  scope :on_issue, -> { where(is_on_issue: true) }

  # Check if this revision has a file attached
  def has_file?
    sharepoint_file_id.present? || sharepoint_web_url.present?
  end

  # Human-readable file size
  def formatted_file_size
    return nil unless file_size

    if file_size < 1024
      "#{file_size} B"
    elsif file_size < 1024 * 1024
      "#{(file_size / 1024.0).round(1)} KB"
    else
      "#{(file_size / (1024.0 * 1024)).round(1)} MB"
    end
  end

  # Full revision label: "Rev A" or "Rev 1"
  def revision_label
    "Rev #{revision}"
  end

  # Mark this revision as on issue
  def set_on_issue!(user = nil)
    job_plan.set_on_issue!(self)
    update!(issued_by: user) if user
  end
end
