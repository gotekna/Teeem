class ClaimStageTemplateLine < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :claim_stage_template

  # Validations
  validates :name, presence: true, length: { maximum: 100 }
  validates :percentage, presence: true,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :sequence_order, presence: true,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :ordered, -> { order(:sequence_order) }
end
