# Standard drawing types within categories
# e.g., 01-PERSPECTIVE, 02-SITE PLAN, 07-SLAB PLAN, 101-KIT CABINETRY
class PlanType < ApplicationRecord
  belongs_to :plan_category
  has_many :job_plans, dependent: :restrict_with_error

  validates :name, presence: true
  validates :code, presence: true
  validates :code, uniqueness: { scope: :plan_category_id }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order, :code) }

  # Full display name: "02 - SITE PLAN"
  def display_name
    "#{code} - #{name}"
  end

  # Category code + type code for variants: "A02" or just "02"
  def full_code
    plan_category&.code.present? ? "#{plan_category.code}#{code}" : code
  end
end
