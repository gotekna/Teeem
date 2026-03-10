class SdaBenchmarkRate < ApplicationRecord
  belongs_to :sda_price_guide

  validates :dwelling_stock_type, presence: true, inclusion: { in: SdaPriceGuide::DWELLING_STOCK_TYPES }
  validates :building_type, presence: true, inclusion: { in: SdaPriceGuide::BUILDING_TYPES.keys }
  validates :design_category, presence: true, inclusion: { in: SdaPriceGuide::DESIGN_CATEGORIES }
  validates :max_residents, presence: true, numericality: { greater_than: 0 }
  validates :annual_base_price, presence: true, numericality: { greater_than: 0 }

  def weekly_rate
    (annual_base_price / 52.0).round(2)
  end

  def label
    SdaPriceGuide::BUILDING_TYPES.dig(building_type, :label) || building_type.humanize
  end
end
