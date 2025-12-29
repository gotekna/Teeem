# Actual plan files attached to jobs
# Links a job to a plan type with optional variant suffix
#
# SSoT: Plan type identification SHOULD go through PlanIdentificationService
# See: app/services/plan_identification/plan_identification_service.rb
#
# MASTERPIECE: Counter caches for O(1) count lookups
# - jobs.plans_count maintained by counter_cache
# - job_plan_tabs.plans_count maintained by counter_cache
# - on_issue counts maintained by callbacks (see update_on_issue_counts)
#
class JobPlan < ApplicationRecord
  belongs_to :job, counter_cache: true
  belongs_to :job_plan_tab, optional: true, counter_cache: :plans_count
  belongs_to :plan_type, optional: true
  belongs_to :current_revision, class_name: 'JobPlanRevision', optional: true
  has_many :revisions, class_name: 'JobPlanRevision', dependent: :destroy
  has_many :identifications, class_name: 'PlanIdentificationRecord', dependent: :destroy

  # Track whether plan_type was set via the service
  attr_accessor :identified_via_service

  # Only enforce uniqueness when plan_type_id is set
  # During initial upload, plans have nil plan_type_id (AI sets it later)
  validates :job_id, uniqueness: {
    scope: [:plan_type_id, :variant_suffix],
    message: 'already has this plan type'
  }, if: -> { plan_type_id.present? }

  before_save :set_display_name
  before_save :check_identification_source, if: :plan_type_id_changed?

  # Auto-regenerate "All Plans" combined PDF when individual plans change
  after_commit :regenerate_all_plans_pdf, on: [:create, :update, :destroy], if: :should_regenerate_all_plans?

  # MASTERPIECE: Update on_issue counter caches when plan changes
  after_commit :update_on_issue_counts, on: [:create, :update, :destroy]

  scope :ordered, -> { includes(:plan_type).order('plan_types.sequence_order', 'plan_types.code', :variant_suffix) }
  scope :on_issue, -> { joins(:current_revision).where(job_plan_revisions: { is_on_issue: true }) }
  scope :regular_plans, -> { where(is_combined_pdf: false) }
  scope :combined_pdfs, -> { where(is_combined_pdf: true) }

  # MASTERPIECE: Optimized scopes for pagination
  scope :with_current_revision, -> { includes(current_revision: :issued_by) }
  scope :ordered_for_list, -> { includes(:plan_type).order('plan_types.sequence_order', 'plan_types.code', :variant_suffix) }

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

  # Get the latest identification record
  def latest_identification
    identifications.recent.first
  end

  private

  def set_display_name
    self.display_name = computed_display_name if display_name.blank?
  end

  # SSoT Guard Rail: Log warning if plan_type_id is changed outside the service
  # This helps catch violations during development
  def check_identification_source
    return if identified_via_service
    return if plan_type_id.nil?  # Clearing plan type is fine

    caller_info = caller.find { |c| c.include?('/app/') && !c.include?('/models/') }
    Rails.logger.warn(
      "[SSoT NOTICE] JobPlan##{id || 'new'} plan_type_id changed outside PlanIdentificationService. " \
      "Caller: #{caller_info || 'unknown'}. " \
      "Consider using PlanIdentificationService.identify_from_text() instead."
    )
  end

  # Only regenerate All Plans when individual plans change (not the combined PDF itself)
  def should_regenerate_all_plans?
    !is_combined_pdf?
  end

  # Queue job to regenerate the combined "All Plans" PDF
  # Uses debounced enqueue to avoid multiple runs for rapid changes
  def regenerate_all_plans_pdf
    PlanCombinerJob.enqueue_for_job(job_id)
  end

  # MASTERPIECE: Update on_issue counter caches
  # Called after any plan change that might affect on_issue counts
  def update_on_issue_counts
    # Update job_plan_tab on_issue count
    if job_plan_tab_id.present?
      count = JobPlan.where(job_plan_tab_id: job_plan_tab_id)
                     .joins(:current_revision)
                     .where(job_plan_revisions: { is_on_issue: true })
                     .count
      JobPlanTab.where(id: job_plan_tab_id)
                .update_all(on_issue_plans_count: count)
    end

    # Update job on_issue count
    count = JobPlan.where(job_id: job_id)
                   .joins(:current_revision)
                   .where(job_plan_revisions: { is_on_issue: true })
                   .count
    Job.where(id: job_id)
       .update_all(on_issue_plans_count: count)
  end
end
