class SdaLocationFactor < ApplicationRecord
  belongs_to :sda_price_guide

  validates :sa4_region, presence: true
  validates :stock_type, presence: true, inclusion: { in: %w[new_build existing_legacy] }
  validates :building_type, presence: true
  validates :factor, presence: true, numericality: { greater_than: 0 }
end
