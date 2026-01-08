class UnitOfMeasure < ApplicationRecord
  self.table_name = "units_of_measure"

  # Validations
  validates :code, presence: true, uniqueness: true, length: { maximum: 20 }
  validates :name, presence: true, length: { maximum: 50 }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sort_order, :name) }
  scope :for_dropdown, -> { active.ordered.select(:id, :code, :name) }

  # Display name for lookups (used by DisplayValueResolver)
  def display_name
    code
  end
end