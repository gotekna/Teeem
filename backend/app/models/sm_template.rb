# frozen_string_literal: true

# SmTemplate - Schedule Master template for SM Gantt system
#
# Templates are reusable schedules that can be copied to constructions
# as sm_tasks. Separate from old schedule_templates (DHTMLX system).
#
class SmTemplate < ApplicationRecord
  # Associations
  has_many :sm_template_rows, dependent: :destroy
  belongs_to :created_by, class_name: 'User', optional: true
  belongs_to :updated_by, class_name: 'User', optional: true

  # Validations
  validates :name, presence: true, length: { maximum: 255 }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :default_template, -> { where(is_default: true) }
  scope :ordered, -> { order(:name) }

  # Callbacks
  before_save :ensure_single_default

  # Get row count
  def row_count
    sm_template_rows.count
  end

  # Get active rows in sequence order
  def ordered_rows
    sm_template_rows.where(is_active: true).order(:sequence_order)
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
