# frozen_string_literal: true

# SmScheduleMasterTemplate - Schedule Master template for SM Gantt system
#
# Templates are reusable schedules that can be copied to constructions
# as sm_tasks. Separate from old schedule_templates (DHTMLX system).
#
# Row Ownership:
# - Rows belong to template via sm_template_ids (JSONB array)
# - Rows can belong to multiple templates (shared between templates)
#
class SmScheduleMasterTemplate < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant
  include ConfigSyncable

  # Associations
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  belongs_to :copied_from, class_name: "SmScheduleMasterTemplate", optional: true

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

  # Get row count
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

  private

  def ensure_single_default
    return unless is_default? && is_default_changed?

    SmScheduleMasterTemplate.where.not(id: id).update_all(is_default: false)
  end
end
