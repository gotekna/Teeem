# frozen_string_literal: true

# SmScheduleMasterVersion - Versioned snapshots of Schedule Master templates
#
# TRANSIENT DRAFT MODEL:
# - Draft versions are metadata-only (no row copying)
# - Rows are edited directly on the template
# - Publishing creates a version snapshot (updates row version_ids)
# - Discarding just deletes the draft record
#
# Version States:
# - draft: Being edited, rows not yet snapshotted
# - published: Active version, rows are snapshotted to this version
# - archived: Previously published, kept for history
#
# Only ONE version can be published at a time per template.
# When a draft is published, the previous published version is archived.
#
# Jobs reference the specific version that was applied to them,
# allowing "upgrade" functionality when newer versions are available.
#
# Usage:
#   template = SmScheduleMasterTemplate.find(1)
#
#   # Get the active published version
#   version = template.published_version
#
#   # Create a new draft (metadata only, no row copying)
#   draft = template.create_draft_version(user: current_user)
#
#   # Publish the draft (snapshots rows to this version)
#   draft.publish!(user: current_user, change_summary: "Added scaffold tasks")
#
class SmScheduleMasterVersion < ApplicationRecord
  # Status constants
  STATUSES = %w[draft published archived].freeze

  # Associations
  belongs_to :sm_schedule_master_template
  belongs_to :published_by, class_name: 'User', optional: true

  has_many :sm_schedule_master_rows,
           class_name: 'SmScheduleMaster',
           foreign_key: :sm_schedule_master_version_id,
           dependent: :destroy

  has_many :jobs,
           foreign_key: :sm_template_version_id,
           dependent: :nullify

  # Validations
  validates :version_number, presence: true,
                             uniqueness: { scope: :sm_schedule_master_template_id }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validate :only_one_draft_per_template
  validate :only_one_published_per_template

  # Scopes
  scope :drafts, -> { where(status: 'draft') }
  scope :published, -> { where(status: 'published') }
  scope :archived, -> { where(status: 'archived') }
  scope :by_version, -> { order(version_number: :desc) }

  # Callbacks
  before_validation :set_version_number, on: :create

  # Instance methods

  def draft?
    status == 'draft'
  end

  def published?
    status == 'published'
  end

  def archived?
    status == 'archived'
  end

  # Publish this draft version (transient draft model)
  # - Archives the current published version (if any)
  # - Snapshots all template rows to this version
  # - Sets this version as published
  def publish!(user:, change_summary: nil)
    raise "Cannot publish a non-draft version" unless draft?

    transaction do
      # Archive current published version
      sm_schedule_master_template.published_version&.archive!

      # Snapshot: Update all template rows to point to this version
      sm_schedule_master_template.sm_schedule_master_rows.update_all(
        sm_schedule_master_version_id: id
      )

      # Update this version
      update!(
        status: 'published',
        published_at: Time.current,
        published_by: user,
        change_summary: change_summary
      )
    end
  end

  # Archive this version (called when a new version is published)
  def archive!
    raise "Cannot archive a draft version" if draft?

    update!(status: 'archived')
  end

  # Discard a draft version (transient draft model)
  # Simply deletes the draft record - rows are not affected
  def discard!
    raise "Cannot discard a non-draft version" unless draft?

    destroy!
  end

  # Create a copy of this version's rows for a new draft
  def copy_rows_to(target_version)
    sm_schedule_master_rows.each do |row|
      new_row = row.dup
      new_row.sm_schedule_master_version_id = target_version.id
      # Clear template array since version now owns the relationship
      new_row.sm_template_ids = []
      new_row.save!
    end
  end

  # Get row count
  # - For draft: count from template (rows not yet snapshotted)
  # - For published/archived: count rows snapshotted to this version
  def row_count
    if draft?
      sm_schedule_master_template.sm_schedule_master_rows.count
    else
      sm_schedule_master_rows.count
    end
  end

  # Get active row count
  def active_row_count
    sm_schedule_master_rows.active.count
  end

  # Display name for UI
  def display_name
    "v#{version_number} (#{status})"
  end

  private

  def set_version_number
    return if version_number.present?

    max = sm_schedule_master_template&.sm_schedule_master_versions&.maximum(:version_number) || 0
    self.version_number = max + 1
  end

  def only_one_draft_per_template
    return unless draft? && new_record?

    existing = sm_schedule_master_template&.sm_schedule_master_versions&.drafts&.exists?
    if existing
      errors.add(:status, "only one draft version allowed per template")
    end
  end

  def only_one_published_per_template
    return unless published? && status_changed?

    existing = sm_schedule_master_template
      &.sm_schedule_master_versions
      &.published
      &.where.not(id: id)
      &.exists?

    if existing
      errors.add(:status, "only one published version allowed per template")
    end
  end
end
