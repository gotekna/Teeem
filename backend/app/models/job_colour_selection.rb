# frozen_string_literal: true

class JobColourSelection < ApplicationRecord
  belongs_to :job
  belongs_to :pricebook_item, class_name: "PricebookItem", optional: true

  validates :category_key, :item_key, presence: true
  validates :item_key, uniqueness: { scope: [:job_id, :category_key], message: "already exists for this category" }

  scope :ordered, -> { order(:category_key, :position) }
  scope :for_category, ->(category_key) { where(category_key: category_key) }

  # Get display colour (from pricebook or custom)
  def display_colour
    pricebook_item&.colour || colour_name
  end

  # Get display colour code (from pricebook or custom)
  def display_code
    pricebook_item&.colour_code || colour_code
  end

  # Get display brand (from pricebook or custom)
  def display_brand
    pricebook_item&.colour_brand || colour_brand
  end

  # Get price from linked pricebook item
  def price
    pricebook_item&.current_price
  end

  # JSON representation for API
  def as_json(options = {})
    super(options).merge(
      display_colour: display_colour,
      display_code: display_code,
      display_brand: display_brand,
      price: price,
      pricebook_item: pricebook_item&.as_json(only: [:id, :item_code, :item_name, :current_price, :colour, :colour_code, :colour_brand, :image_url])
    )
  end
end
