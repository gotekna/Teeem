# frozen_string_literal: true

# SmTemplate - Schedule Master template for SM Gantt system
#
# Templates are reusable schedules that can be copied to constructions
# as sm_tasks. Separate from old schedule_templates (DHTMLX system).
#
# Multi-Template Support:
# - SmScheduleMaster records can belong to multiple templates via sm_template_ids (JSONB array)
# - Use sm_schedule_master_rows method to get rows for this template
# - A single row can be shared across templates (SSoT)
#
class SmTemplate < ApplicationRecord
  # Associations
  # Note: has_many is replaced with a method that queries by JSONB containment
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true

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
    SmTemplateCopyService.new(self, construction, options).execute
  end

  private

  def ensure_single_default
    return unless is_default? && is_default_changed?

    SmTemplate.where.not(id: id).update_all(is_default: false)
  end
end
