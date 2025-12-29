# frozen_string_literal: true

# SmScheduleMasterTemplate - Schedule Master template for SM Gantt system
#
# Templates are reusable schedules that can be copied to constructions
# as sm_tasks. Separate from old schedule_templates (DHTMLX system).
#
# Versioning (Transient Drafts):
# - Templates have versions (draft, published, archived)
# - Only one published version at a time
# - Jobs reference the specific version applied
# - TRANSIENT DRAFTS: Draft is metadata-only, no row copying
# - Edits happen directly to template rows
# - Publish = create version snapshot, Discard = delete draft record
#
# Row Ownership:
# - Rows belong to template via sm_template_ids (JSONB array)
# - Rows also have sm_schedule_master_version_id for version snapshot
# - Version ID is set when publishing (snapshot point)
#
class SmScheduleMasterTemplate < ApplicationRecord
  # Associations
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  belongs_to :copied_from, class_name: "SmScheduleMasterTemplate", optional: true

  has_many :sm_schedule_master_versions, dependent: :destroy
  has_many :copies, class_name: "SmScheduleMasterTemplate", foreign_key: :copied_from_id
  has_many :job_types

  # Validations
  validates :name, presence: true, length: { maximum: 255 }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :default_template, -> { where(is_default: true) }
  scope :ordered, -> { order(:name) }

  # Callbacks
  before_save :ensure_single_default

  # Get all rows for this template (via JSONB containment query)
  def sm_schedule_master_rows
    SmScheduleMaster.for_template(id)
  end

  # Get row count (always from template rows - transient draft model)
  def row_count
    sm_schedule_master_rows.count
  end

  # Get active rows in sequence order
  def ordered_rows
    sm_schedule_master_rows.active.in_sequence
  end

  # Copy template to a construction as sm_tasks
  def copy_to_construction(construction, options = {})
    SmScheduleMasterTemplateCopyService.new(self, construction, options).execute
  end

  # === Version Management ===

  # Get the currently published version (or nil if none)
  def published_version
    sm_schedule_master_versions.published.first
  end

  # Get the current draft version (or nil if none)
  def draft_version
    sm_schedule_master_versions.drafts.first
  end

  # Get the latest version (published or draft)
  def latest_version
    sm_schedule_master_versions.by_version.first
  end

  # Get the version to use for new jobs (published version)
  def active_version
    published_version
  end

  # Create a new draft version (transient - metadata only, no row copying)
  # Rows are edited in place on the template, draft is just a marker
  def create_draft_version(user: nil)
    raise "Draft version already exists" if draft_version.present?

    sm_schedule_master_versions.create!(
      status: 'draft',
      change_summary: nil
    )
  end

  # Get or create a draft version for editing
  def draft_version!
    draft_version || create_draft_version
  end

  # Check if a newer version is available than what a job has
  def has_newer_version_than?(job)
    return false unless job.sm_template_version_id.present?
    return false unless published_version.present?

    job.sm_template_version_id != published_version.id
  end

  private

  def ensure_single_default
    return unless is_default? && is_default_changed?

    SmScheduleMasterTemplate.where.not(id: id).update_all(is_default: false)
  end
end
