# Revision history for job plans
# Tracks each revision with storage file links
#
# MASTERPIECE: Counter cache callbacks
# - Updates job_plans.revisions_count on create/destroy
# - Updates on_issue counts when is_on_issue changes
#
class JobPlanRevision < ApplicationRecord
  belongs_to :job_plan
  belongs_to :issued_by, class_name: 'User', optional: true
  belongs_to :storage_blob, optional: true

  validates :revision, presence: true
  validates :revision, uniqueness: { scope: :job_plan_id }

  scope :ordered, -> { order(revision_date: :desc, created_at: :desc) }
  scope :on_issue, -> { where(is_on_issue: true) }

  # MASTERPIECE: Counter cache callbacks
  after_commit :update_revisions_count, on: [:create, :destroy]
  after_commit :cascade_on_issue_update, if: :saved_change_to_is_on_issue?

  # Check if this revision has a file attached
  def has_file?
    storage_blob_id.present? || storage_reference.present? || storage_web_url.present?
  end

  # Provider-agnostic storage reference
  # Prefers blob storage path (Phase 3), falls back to legacy references
  def storage_reference
    storage_blob&.storage_path || storage_item_id.presence || storage_file_id
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

  private

  # MASTERPIECE: Update revisions_count counter cache
  def update_revisions_count
    return unless job_plan_id.present?

    count = JobPlanRevision.where(job_plan_id: job_plan_id).count
    JobPlan.where(id: job_plan_id).update_all(revisions_count: count)
  end

  # MASTERPIECE: Cascade on_issue change to plan's counter caches
  def cascade_on_issue_update
    return unless job_plan.present?

    # Trigger the plan's callback to update tab and job on_issue counts
    job_plan.send(:update_on_issue_counts)
  end
end
