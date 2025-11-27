class UnrealVariable < ApplicationRecord
  validates :variable_name, presence: true, uniqueness: true
  validates :claude_value, presence: true, numericality: true

  # Scope for active variables
  scope :active, -> { where(is_active: true) }
end
