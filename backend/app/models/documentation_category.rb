class DocumentationCategory < ApplicationRecord
  validates :name, presence: true, uniqueness: true
  validates :sequence_order, presence: true

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order) }

  before_validation :set_default_sequence_order, on: :create
  after_create :add_to_all_existing_jobs

  private

  def set_default_sequence_order
    return if sequence_order.present?

    max_order = DocumentationCategory.maximum(:sequence_order) || 0
    self.sequence_order = max_order + 1
  end

  # When a new category is created, add it to all existing jobs
  def add_to_all_existing_jobs
    Job.find_each do |construction|
      # Skip if this tab already exists for this job
      next if construction.construction_documentation_tabs.exists?(name: name)

      construction.construction_documentation_tabs.create!(
        name: name,
        icon: icon,
        color: color,
        description: description,
        folder_path: folder_path,
        sequence_order: sequence_order,
        is_active: true
      )
    end
  end
end
