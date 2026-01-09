# frozen_string_literal: true

class JobSpecification < ApplicationRecord
  belongs_to :job
  belongs_to :pricebook_item, class_name: "PricebookItem", optional: true

  validates :section_key, :item_key, presence: true
  validates :item_key, uniqueness: { scope: [:job_id, :section_key], message: "already exists for this section" }

  scope :ordered, -> { order(:section_key, :position) }
  scope :for_section, ->(section_key) { where(section_key: section_key) }

  # Get display value (from pricebook or custom)
  def display_value
    pricebook_item&.item_name || custom_value
  end

  # Get price from linked pricebook item
  def price
    pricebook_item&.current_price
  end

  # Get colour from linked pricebook item
  def colour
    pricebook_item&.colour
  end

  # Get colour code from linked pricebook item
  def colour_code
    pricebook_item&.colour_code
  end

  # JSON representation for API
  def as_json(options = {})
    super(options).merge(
      display_value: display_value,
      price: price,
      colour: colour,
      colour_code: colour_code,
      pricebook_item: pricebook_item&.as_json
    )
  end
end
