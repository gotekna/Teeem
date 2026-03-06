class SdaPriceGuide < ApplicationRecord
  has_many :sda_benchmark_rates, dependent: :destroy
  has_many :sda_location_factors, dependent: :destroy
  has_many :sda_mrrc_rates, dependent: :destroy

  validates :financial_year, presence: true
  validates :version, presence: true
  validates :valid_from, presence: true

  scope :current_guide, -> { where(current: true).order(valid_from: :desc).first }

  DWELLING_STOCK_TYPES = %w[post_2023_new_build pre_2023_new_build existing_stock legacy_stock].freeze

  BUILDING_TYPES = {
    "apartment_1br_1res" => { label: "Apartment, 1 bedroom, 1 resident", max_residents: 1 },
    "apartment_2br_1res" => { label: "Apartment, 2 bedrooms, 1 resident", max_residents: 1 },
    "apartment_2br_2res" => { label: "Apartment, 2 bedrooms, 2 residents", max_residents: 2 },
    "apartment_3br_2res" => { label: "Apartment, 3 bedrooms, 2 residents", max_residents: 2 },
    "villa_1res"         => { label: "Villa/Duplex/Townhouse, 1 resident", max_residents: 1 },
    "villa_2res"         => { label: "Villa/Duplex/Townhouse, 2 residents", max_residents: 2 },
    "villa_3res"         => { label: "Villa/Duplex/Townhouse, 3 residents", max_residents: 3 },
    "house_2res"         => { label: "House, 2 residents", max_residents: 2 },
    "house_3res"         => { label: "House, 3 residents", max_residents: 3 },
    "group_home_4res"    => { label: "Group Home, 4 residents", max_residents: 4 },
    "group_home_5res"    => { label: "Group Home, 5 residents", max_residents: 5 },
  }.freeze

  DESIGN_CATEGORIES = %w[improved_liveability fully_accessible robust robust_breakout_room high_physical_support].freeze

  # Look up the annual base price for a property's configuration
  def self.lookup_rate(property)
    guide = current_guide
    return nil unless guide

    rate = guide.sda_benchmark_rates.find_by(
      dwelling_stock_type: property.sda_enrolled_as || "post_2023_new_build",
      building_type: property.sda_price_building_type,
      design_category: property.sda_category,
      fire_sprinklers: property.sda_fire_sprinklers || false,
      gst_credits_claimed: property.sda_gst_credits_claimed || true,
      onsite_overnight_assistance: false # default
    )
    return nil unless rate

    # Apply location factor
    factor = guide.sda_location_factors.find_by(
      sa4_region: property.sda_location_sa4,
      stock_type: property.sda_enrolled_as&.include?("new_build") ? "new_build" : "existing_legacy",
      building_type: property.sda_price_building_type
    )

    location_factor = factor&.factor || 1.0
    (rate.annual_base_price * location_factor).round(0)
  end

  # Get MRRC for a participant type
  def self.mrrc_annual(participant_type: "single", payment_type: "mrrc")
    guide = current_guide
    return nil unless guide

    guide.sda_mrrc_rates.find_by(
      participant_type: participant_type,
      payment_type: payment_type
    )&.total_annual
  end

  # Mark this guide as current and unmark others
  def make_current!
    SdaPriceGuide.where.not(id: id).update_all(current: false)
    update!(current: true)
  end

  # Check if the current guide has expired
  def self.expired?
    guide = current_guide
    return true unless guide
    guide.valid_to.present? && guide.valid_to < Date.current
  end
end
