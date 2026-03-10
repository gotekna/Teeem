class Property < ApplicationRecord
  acts_as_tenant :tenant
  include Searchable

  searchable_columns :name, :street_address, :suburb, :property_code

  # Lookups
  belongs_to :property_type, optional: true
  belongs_to :property_status, optional: true
  belongs_to :owner_contact, class_name: "Contact", optional: true
  belongs_to :managing_agent_contact, class_name: "Contact", optional: true
  belongs_to :job, optional: true

  # Associations
  has_many :property_contacts, dependent: :destroy
  has_many :contacts, through: :property_contacts
  has_many :tenancies, dependent: :destroy
  has_many :property_bills, dependent: :destroy
  has_many :property_inspections, dependent: :destroy
  has_many :ndis_claims, dependent: :destroy
  has_many :sda_vacancies, dependent: :destroy
  has_many :sda_agreements, dependent: :destroy
  has_many :sda_claims, dependent: :destroy
  has_many :sda_sil_providers, dependent: :destroy
  has_many :sda_compliance_items, dependent: :destroy
  has_many :sda_incidents, dependent: :destroy
  has_many :sda_participant_outcomes, dependent: :destroy
  has_many :sda_design_assessments, dependent: :destroy
  has_many :sda_rent_ledger_entries, dependent: :destroy
  has_many :sda_owner_statements, dependent: :destroy
  has_many :sda_restrictive_practices, dependent: :destroy
  has_many :sda_notifications, dependent: :destroy
  has_many :sda_enquiries, dependent: :destroy

  # Validations
  validates :street_address, presence: true

  # Auto-generate property code
  before_create :generate_property_code, if: -> { property_code.blank? }

  # Scopes
  scope :with_lookups, -> { includes(:property_type, :property_status, :owner_contact) }
  scope :sda, -> { where(sda_enrolled: true) }
  scope :sda_enrolled, -> { where(sda_enrolled: true) }
  scope :sda_pending, -> { where.not(sda_category: nil).where(sda_enrolled: false) }
  scope :by_sda_category, ->(cat) { where(sda_category: cat) }
  scope :vacant, -> { left_joins(:tenancies).where(tenancies: { id: nil }).or(left_joins(:tenancies).where.not(tenancies: { status: "active" })) }
  scope :publicly_listed, -> { where(publicly_listed: true) }
  scope :public_vacancies, -> { publicly_listed.where(public_listing_type: "vacancy") }
  scope :public_for_sale, -> { publicly_listed.where(public_listing_type: "for_sale") }

  # SDA constants
  SDA_CATEGORIES = %w[improved_liveability fully_accessible robust high_physical_support].freeze
  SDA_BUILDING_TYPES = %w[apartment duplex group_home house townhouse villa].freeze
  SDA_ENROLMENT_STATUSES = %w[not_started in_progress submitted under_review info_requested approved enrolled rejected].freeze

  validates :sda_category, inclusion: { in: SDA_CATEGORIES, allow_nil: true }
  validates :sda_building_type, inclusion: { in: SDA_BUILDING_TYPES, allow_nil: true }
  validates :sda_enrolment_status, inclusion: { in: SDA_ENROLMENT_STATUSES, allow_nil: true }
  validates :public_listing_type, inclusion: { in: %w[vacancy for_sale], allow_nil: true }
  validates :public_slug, uniqueness: true, allow_nil: true

  before_save :generate_public_slug, if: -> { publicly_listed? && public_slug.blank? }

  def full_address
    [street_address, suburb, state, postcode].compact_blank.join(", ")
  end

  def active_tenancy
    tenancies.find_by(status: "active")
  end

  def sda?
    sda_enrolled?
  end

  # Map property building type to SDA price guide building type key
  def sda_price_building_type
    return nil unless sda_building_type && bedrooms && sda_max_residents

    case sda_building_type
    when "apartment"
      case [bedrooms, sda_max_residents]
      when [1, 1] then "apartment_1br_1res"
      when [2, 1] then "apartment_2br_1res"
      when [2, 2] then "apartment_2br_2res"
      when [3, 2] then "apartment_3br_2res"
      else "apartment_#{bedrooms}br_#{sda_max_residents}res"
      end
    when "villa", "duplex", "townhouse"
      "villa_#{sda_max_residents}res"
    when "house"
      "house_#{sda_max_residents}res"
    when "group_home"
      "group_home_#{sda_max_residents}res"
    end
  end

  # Which stock category for the SDA price guide lookup
  def sda_enrolled_as
    sda_new_or_existing == "new_build" ? "post_2023_new_build" : "existing_stock"
  end

  # Returns 0-100 percentage of how complete the SDA enrolment data is
  def sda_enrolment_completeness
    required_fields = %w[street_address suburb state postcode sda_category sda_building_type bedrooms sda_max_residents]
    filled = required_fields.count { |f| send(f).present? }
    ((filled.to_f / required_fields.length) * 100).round(0)
  end

  # ── Valuation Methods ──

  CONSTRUCTION_TYPES = %w[brick_veneer timber_frame concrete steel_frame double_brick weatherboard other].freeze
  validates :construction_type, inclusion: { in: CONSTRUCTION_TYPES, allow_blank: true }

  # Annual gross rental income from active tenancy
  def annual_gross_rent
    tenancy = active_tenancy
    return 0 unless tenancy

    case tenancy.rent_frequency
    when "weekly" then tenancy.weekly_rent * 52
    when "fortnightly" then tenancy.weekly_rent * 26
    when "monthly" then tenancy.weekly_rent * 12
    else tenancy.weekly_rent * 52
    end
  end

  # Total annual expenses (for net yield)
  def annual_expenses
    mgmt_fee = (annual_gross_rent * (management_fee_pct || 0) / 100.0)
    vacancy = (annual_gross_rent * (vacancy_rate_pct || 0) / 100.0)
    fixed = (annual_insurance || 0) + (annual_council_rates || 0) +
            (annual_water_rates || 0) + (annual_body_corporate || 0) +
            (annual_other_expenses || 0)
    # Add maintenance from property bills
    maintenance = property_bills.where(bill_type: "maintenance", charge_to: "owner")
                                .where("bill_date >= ?", 1.year.ago).sum(:amount)
    mgmt_fee + vacancy + fixed + maintenance
  end

  # Net annual income
  def annual_net_income
    annual_gross_rent - annual_expenses
  end

  # Property value (current valuation or purchase price as fallback)
  def effective_value
    current_valuation.presence || purchase_price || 0
  end

  # 1. Gross Rental Yield = (Annual Rent / Property Value) × 100
  def gross_rental_yield
    return nil if effective_value.zero?
    (annual_gross_rent / effective_value * 100).round(2)
  end

  # 2. Net Rental Yield = (Annual Rent - Expenses) / Property Value × 100
  def net_rental_yield
    return nil if effective_value.zero?
    (annual_net_income / effective_value * 100).round(2)
  end

  # 3. Cap Rate = Net Operating Income / Property Value × 100
  def cap_rate
    net_rental_yield # Same calculation for single property
  end

  # 4. Gross Rent Multiplier = Property Value / Annual Gross Rent
  def gross_rent_multiplier
    return nil if annual_gross_rent.zero?
    (effective_value / annual_gross_rent).round(1)
  end

  # 5. Cost Approach = Land Value + (Building Replacement - Depreciation)
  def cost_approach_value
    return nil unless land_value.present? && building_replacement_cost.present?
    age = year_built ? (Date.current.year - year_built) : 0
    depreciation_rate = 0.015 # 1.5% per year (50-year lifespan)
    depreciation = [building_replacement_cost * depreciation_rate * age, building_replacement_cost * 0.8].min
    (land_value + building_replacement_cost - depreciation).round(0)
  end

  # 6. DCF (Discounted Cash Flow) - 10 year projection
  def dcf_value(discount_rate: 0.08, rental_growth: 0.03, expense_growth: 0.025, hold_years: 10, exit_cap_rate: 0.06)
    return nil if annual_gross_rent.zero?

    pv = 0
    rent = annual_gross_rent.to_f
    expenses = annual_expenses.to_f

    hold_years.times do |year|
      rent *= (1 + rental_growth) if year > 0
      expenses *= (1 + expense_growth) if year > 0
      net_cf = rent - expenses
      pv += net_cf / ((1 + discount_rate) ** (year + 1))
    end

    # Residual value at exit
    final_year_noi = (rent * (1 + rental_growth)) - (expenses * (1 + expense_growth))
    residual = final_year_noi / exit_cap_rate
    pv += residual / ((1 + discount_rate) ** hold_years)

    pv.round(0)
  end

  # Capital gain (unrealised)
  def unrealised_capital_gain
    return nil unless purchase_price.present? && effective_value > 0
    effective_value - total_cost_base
  end

  # Total cost base for CGT
  def total_cost_base
    (purchase_price || 0) + (cost_base_stamp_duty || 0) +
    (cost_base_legal_fees || 0) + (cost_base_other || 0) +
    (capital_improvements_total || 0)
  end

  # CGT estimate (50% discount for 12+ months)
  def estimated_cgt(marginal_tax_rate: 0.37, selling_costs: 0)
    gain = unrealised_capital_gain
    return nil unless gain

    adjusted_gain = gain - selling_costs
    return 0 if adjusted_gain <= 0

    # Apply 50% CGT discount if held 12+ months
    held_over_12_months = purchase_date.present? && purchase_date < 12.months.ago
    taxable_gain = held_over_12_months ? adjusted_gain * 0.5 : adjusted_gain
    (taxable_gain * marginal_tax_rate).round(0)
  end

  # All valuations summary
  def valuation_summary
    {
      effective_value: effective_value,
      purchase_price: purchase_price,
      current_valuation: current_valuation,
      annual_gross_rent: annual_gross_rent,
      annual_expenses: annual_expenses,
      annual_net_income: annual_net_income,
      gross_rental_yield: gross_rental_yield,
      net_rental_yield: net_rental_yield,
      cap_rate: cap_rate,
      gross_rent_multiplier: gross_rent_multiplier,
      cost_approach_value: cost_approach_value,
      dcf_value: dcf_value,
      unrealised_capital_gain: unrealised_capital_gain,
      total_cost_base: total_cost_base,
      estimated_cgt: estimated_cgt,
    }
  end

  private

  def generate_property_code
    max_num = Property.where(tenant_id: tenant_id).maximum(:id) || 0
    self.property_code = "P-#{max_num + 1}"
  end

  def generate_public_slug
    base = [suburb, sda_category, sda_building_type, bedrooms&.to_s].compact_blank.join("-").parameterize
    base = "sda-property" if base.blank?
    slug = base
    counter = 1
    while Property.where(public_slug: slug).where.not(id: id).exists?
      slug = "#{base}-#{counter}"
      counter += 1
    end
    self.public_slug = slug
  end

  # Safe serialization for public API — excludes sensitive data
  def public_listing_json
    {
      slug: public_slug,
      headline: public_headline,
      description: public_description,
      listingType: public_listing_type,
      priceDisplay: listing_price_display,
      heroImage: hero_image_url,
      galleryImages: gallery_image_urls || [],
      suburb: suburb,
      state: state,
      postcode: postcode,
      address: public_listing_type == "for_sale" ? street_address : nil,
      fullAddress: public_listing_type == "for_sale" ? full_address : [suburb, state, postcode].compact_blank.join(", "),
      latitude: latitude&.to_f,
      longitude: longitude&.to_f,
      bedrooms: bedrooms,
      bathrooms: bathrooms,
      parking: parking_spaces,
      floorArea: floor_area_sqm&.to_f,
      sdaCategory: sda_category,
      buildingType: sda_building_type,
      maxResidents: sda_max_residents,
      sdaFeatures: sda_features || {},
      providerName: tenant&.name,
      enquiryEmail: enquiry_email,
      enquiryPhone: enquiry_phone,
    }
  end
end
