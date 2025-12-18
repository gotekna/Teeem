# Actual plan files attached to jobs
# Links a job to a plan type with optional variant suffix
class JobPlan < ApplicationRecord
  belongs_to :job
  belongs_to :job_plan_tab, optional: true
  belongs_to :plan_type, optional: true
  belongs_to :current_revision, class_name: 'JobPlanRevision', optional: true
  has_many :revisions, class_name: 'JobPlanRevision', dependent: :destroy

  # Only enforce uniqueness when plan_type_id is set
  # During initial upload, plans have nil plan_type_id (AI sets it later)
  validates :job_id, uniqueness: {
    scope: [:plan_type_id, :variant_suffix],
    message: 'already has this plan type'
  }, if: -> { plan_type_id.present? }

  before_save :set_display_name

  scope :ordered, -> { includes(:plan_type).order('plan_types.sequence_order', 'plan_types.code', :variant_suffix) }
  scope :on_issue, -> { joins(:current_revision).where(job_plan_revisions: { is_on_issue: true }) }

  # Full display name: "02 - SITE PLAN" or "02b - SITE PLAN"
  def computed_display_name
    return display_name if display_name.present?
    return custom_display_name if plan_type.nil?

    code_with_suffix = "#{plan_type.code}#{variant_suffix}"
    "#{code_with_suffix} - #{plan_type.name}"
  end

  # Custom name if no plan type
  def custom_display_name
    display_name.presence || "Unnamed Plan"
  end

  # Get the on-issue revision
  def on_issue_revision
    current_revision if current_revision&.is_on_issue?
  end

  # Add a new revision
  def add_revision!(attributes = {})
    revision_format = RevisionFormat.default_format
    next_rev = revision_format&.next_revision(revisions.maximum(:revision))

    revision = revisions.create!(
      revision: next_rev || 'A',
      revision_date: Date.current,
      **attributes
    )

    # Set as current revision if this is the first one
    update!(current_revision: revision) if current_revision.nil?

    revision
  end

  # Set a revision as "on issue"
  def set_on_issue!(revision)
    transaction do
      revisions.update_all(is_on_issue: false)
      revision.update!(is_on_issue: true, issued_date: Date.current)
      update!(current_revision: revision)
    end
  end

  private

  def set_display_name
    self.display_name = computed_display_name if display_name.blank?
  end
end
