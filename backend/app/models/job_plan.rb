# Actual plan files attached to jobs
#
# MASTERPIECE: Counter caches for O(1) count lookups
# - jobs.plans_count maintained by counter_cache
# - job_plan_tabs.plans_count maintained by counter_cache
# - on_issue counts maintained by callbacks (see update_on_issue_counts)
#
class JobPlan < ApplicationRecord
  # Convenience alias: display_name is the SSoT column, but .name is expected by
  # scripts and generic code that iterates models
  alias_attribute :name, :display_name

  belongs_to :job, counter_cache: :plans_count
  belongs_to :job_plan_tab, optional: true, counter_cache: :plans_count
  belongs_to :current_revision, class_name: 'JobPlanRevision', optional: true
  has_many :revisions, class_name: 'JobPlanRevision', dependent: :destroy

  # PDF Takeoff (Feb 2026)
  has_many :page_scales, dependent: :destroy
  has_many :measurements, class_name: 'TakeoffMeasurement', dependent: :nullify

  before_save :set_display_name

  # Auto-regenerate "All Plans" combined PDF when individual plans change
  after_commit :update_on_issue_counts, on: [:create, :update, :destroy]

  scope :ordered, -> { order(:sort_order, :display_name) }
  scope :on_issue, -> { joins(:current_revision).where(job_plan_revisions: { is_on_issue: true }) }
  scope :regular_plans, -> { where(is_combined_pdf: false) }
  scope :combined_pdfs, -> { where(is_combined_pdf: true) }

  scope :with_current_revision, -> { includes(current_revision: :issued_by) }
  scope :ordered_for_list, -> { order(:sort_order, :display_name) }

  def computed_display_name
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

  # MASTERPIECE: Update on_issue counter caches
  def update_on_issue_counts
    if job_plan_tab_id.present?
      count = JobPlan.where(job_plan_tab_id: job_plan_tab_id)
                     .joins(:current_revision)
                     .where(job_plan_revisions: { is_on_issue: true })
                     .count
      JobPlanTab.where(id: job_plan_tab_id)
                .update_all(on_issue_plans_count: count)
    end

    count = JobPlan.where(job_id: job_id)
                   .joins(:current_revision)
                   .where(job_plan_revisions: { is_on_issue: true })
                   .count
    Job.where(id: job_id)
       .update_all(on_issue_plans_count: count)
  end
end
