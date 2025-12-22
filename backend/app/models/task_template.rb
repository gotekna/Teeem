class TaskTemplate < ApplicationRecord
  # Note: project_tasks association removed in Phase 6 Tier 4
  # TaskTemplate now provides patterns for SmTask creation

  validates :name, presence: true
  validates :task_type, presence: true
  validates :category, presence: true
  validates :default_duration_days, presence: true, numericality: { greater_than: 0 }

  scope :standard, -> { where(is_standard: true) }
  scope :custom, -> { where(is_standard: false) }
  scope :by_sequence, -> { order(:sequence_order, :id) }
  scope :by_category, ->(category) { where(category: category) }
  scope :milestones, -> { where(is_milestone: true) }
  scope :with_photos, -> { where(requires_photo: true) }

  def predecessor_templates
    return [] if predecessor_template_codes.blank?

    TaskTemplate.where(sequence_order: predecessor_template_codes)
  end

  def successor_templates
    TaskTemplate.where("? = ANY(predecessor_template_codes)", sequence_order)
  end
end
