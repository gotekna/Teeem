class EstimateLineItem < ApplicationRecord
  # Associations
  belongs_to :estimate

  # Validations
  validates :item_description, presence: true
  validates :quantity, presence: true, numericality: { greater_than: 0 }
  validates :unit, presence: true

  # Methods
  def display_name
    parts = []
    parts << category if category.present?
    parts << item_description
    parts.join(" - ")
  end

  def quantity_with_unit
    "#{quantity} #{unit}"
  end
end
