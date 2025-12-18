# Global SSoT for plan categories (like DocumentationCategory)
# Categories: Drawings, Certification Drawings, Cabinets
class PlanCategory < ApplicationRecord
  has_many :plan_types, dependent: :destroy
  has_many :job_plan_tabs, dependent: :nullify

  validates :name, presence: true
  validates :code, uniqueness: { allow_blank: true }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order, :name) }

  # Create job plan tabs for a new job
  def self.create_tabs_for_job(job)
    active.ordered.each do |category|
      job.job_plan_tabs.find_or_create_by!(plan_category: category) do |tab|
        tab.name = category.name
        tab.code = category.code
        tab.sequence_order = category.sequence_order
      end
    end
  end
end
