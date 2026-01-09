# Join model for many-to-many relationship between PlanCategory and PlanType
# Allows a plan type to belong to multiple categories
class PlanCategoryPlanType < ApplicationRecord
  belongs_to :plan_category
  belongs_to :plan_type

  validates :plan_category_id, uniqueness: { scope: :plan_type_id }

  scope :ordered, -> { order(:sequence_order) }
end
