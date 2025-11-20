class WhsInspectionTemplate < ApplicationRecord
  # Associations
  has_many :whs_inspections

  # Constants
  INSPECTION_TYPES = %w[daily weekly monthly ad_hoc].freeze
  CATEGORIES = %w[site_safety equipment housekeeping traffic_management environmental].freeze

  # Validations
  validates :name, presence: true
  validates :inspection_type, inclusion: { in: INSPECTION_TYPES }, allow_nil: true
  validates :category, inclusion: { in: CATEGORIES }, allow_nil: true
  validates :pass_threshold_percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :inactive, -> { where(active: false) }
  scope :by_type, ->(type) { where(inspection_type: type) }
  scope :by_category, ->(category) { where(category: category) }

  # Helper methods
  def item_count
    checklist_items&.length || 0
  end

  def deactivate!
    update!(active: false)
  end

  def activate!
    update!(active: true)
  end

  def duplicate
    new_template = dup
    new_template.name = "#{name} (Copy)"
    new_template.checklist_items = checklist_items.deep_dup if checklist_items.present?
    new_template
  end
end
