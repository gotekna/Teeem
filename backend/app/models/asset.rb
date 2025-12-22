class Asset < ApplicationRecord
  # Associations
  belongs_to :corporate_company, foreign_key: "company_id"
  belongs_to :assigned_user, class_name: "User", optional: true

  # Existing associations
  has_one :asset_insurance, dependent: :destroy
  has_many :asset_service_histories, dependent: :destroy
  has_many :corporate_company_documents, dependent: :nullify

  # New associations for Asset Register
  has_one :depreciation_profile, class_name: "AssetDepreciationProfile", dependent: :destroy
  has_many :depreciation_schedules, class_name: "AssetDepreciationSchedule", dependent: :destroy
  has_one :disposal, class_name: "AssetDisposal", dependent: :destroy
  has_many :odometer_readings, class_name: "AssetOdometerReading", dependent: :destroy
  has_many :expenses, class_name: "AssetExpense", dependent: :destroy

  # Active Storage for photos
  has_many_attached :photos

  # Asset type codes for asset number generation
  ASSET_TYPE_CODES = {
    "vehicle" => "VEH",
    "equipment" => "EQP",
    "property" => "PRO",
    "other" => "OTH"
  }.freeze

  # Validations
  validates :name, presence: true
  validates :asset_type, inclusion: { in: %w[vehicle equipment property other] }
  validates :status, inclusion: { in: %w[active disposed under_repair] }
  validates :purchase_price, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :current_book_value, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :abbreviation, format: { with: /\A[A-Z0-9\-]+\z/, message: "must be uppercase letters, numbers, or hyphens", allow_blank: true }
  validates :asset_number, uniqueness: true, allow_nil: true

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :disposed, -> { where(status: "disposed") }
  scope :vehicles, -> { where(asset_type: "vehicle") }
  scope :equipment, -> { where(asset_type: "equipment") }
  scope :property, -> { where(asset_type: "property") }
  scope :by_type, ->(type) { where(asset_type: type) }
  scope :assigned_to, ->(user) { where(assigned_user_id: user.id) }
  scope :unassigned, -> { where(assigned_user_id: nil) }
  scope :with_depreciation, -> { joins(:depreciation_profile) }
  scope :depreciable, -> { active.joins(:depreciation_profile) }

  # Callbacks
  before_validation :generate_asset_number, on: :create
  after_create :create_activity
  after_create :create_default_depreciation_profile
  after_update :create_update_activity

  # Instance methods
  def display_name
    if make.present? && model.present?
      "#{name} (#{make} #{model})"
    else
      name
    end
  end

  def active?
    status == "active"
  end

  def has_insurance?
    asset_insurance.present? && asset_insurance.status == "active"
  end

  def insurance_expiring_soon?(days = 30)
    return false unless has_insurance?
    asset_insurance.renewal_date.present? &&
      asset_insurance.renewal_date <= days.days.from_now &&
      asset_insurance.renewal_date >= Date.today
  end

  def insurance_expired?
    return false unless asset_insurance.present?
    asset_insurance.renewal_date.present? && asset_insurance.renewal_date < Date.today
  end

  def last_service
    asset_service_histories.order(service_date: :desc).first
  end

  def last_service_date
    last_service&.service_date
  end

  def next_service_due
    return nil unless last_service.present?
    last_service.next_service_date
  end

  def service_overdue?
    next_service_due.present? && next_service_due < Date.today
  end

  def total_maintenance_cost
    asset_service_histories.sum(:cost) || 0
  end

  def age_in_years
    return nil unless purchase_date.present?
    ((Date.today - purchase_date).to_f / 365.25).round(1)
  end

  def depreciation_amount
    return 0 unless purchase_price.present? && current_book_value.present?
    purchase_price - current_book_value
  end

  def needs_attention?
    insurance_expired? || service_overdue?
  end

  def documents_count
    corporate_company_documents.count
  end

  # Asset number in format: ABC-VEH-001
  def generate_asset_number
    return if asset_number.present?

    company_code = corporate_company&.code.presence || "XXX"
    type_code = ASSET_TYPE_CODES[asset_type] || "OTH"

    # Get next sequence number for this company + type combination
    last_asset = Asset.where(company_id: company_id, asset_type: asset_type)
                      .where.not(asset_number: nil)
                      .order(asset_number: :desc)
                      .first

    if last_asset&.asset_number
      # Extract sequence from last asset number
      sequence = last_asset.asset_number.split("-").last.to_i + 1
    else
      sequence = 1
    end

    self.asset_number = "#{company_code}-#{type_code}-#{sequence.to_s.rjust(3, '0')}"
  end

  # Depreciation convenience methods
  def current_book_wdv
    depreciation_profile&.current_book_wdv || purchase_price || 0
  end

  def current_tax_wdv
    depreciation_profile&.current_tax_wdv || purchase_price || 0
  end

  def total_book_depreciation
    depreciation_schedules.sum(:book_depreciation)
  end

  def total_tax_depreciation
    depreciation_schedules.sum(:tax_depreciation)
  end

  def disposed?
    status == "disposed" && disposal.present?
  end

  # Total cost of ownership (maintenance + expenses)
  def total_cost_of_ownership
    total_maintenance_cost + expenses.sum(:amount)
  end

  # Total expenses by type
  def expenses_by_type
    expenses.group(:expense_type).sum(:amount)
  end

  # Last odometer reading
  def last_odometer_reading
    odometer_readings.order(reading_date: :desc).first
  end

  # Current odometer (from asset or last reading)
  def current_odometer
    odometer_reading || last_odometer_reading&.odometer_km
  end

  # Current hours (for equipment)
  def current_hours
    hours_reading || last_odometer_reading&.hours
  end

  # Is this a vehicle?
  def vehicle?
    asset_type == "vehicle"
  end

  # Is this a property?
  def property?
    asset_type == "property"
  end

  # Is this equipment?
  def equipment?
    asset_type == "equipment"
  end

  # Assigned user name
  def assigned_to_name
    assigned_user&.full_name
  end

  # Company name (from association)
  def company_name
    corporate_company&.name
  end

  # Company code (from association)
  def company_code
    corporate_company&.code
  end

  private

  # Create default depreciation profile when asset is created
  def create_default_depreciation_profile
    return unless purchase_price.present? && depreciation_profile.nil?

    # Determine default method based on asset type
    default_tax_method = if property?
                           "division_43"
    elsif purchase_price.to_f < 1000
                           "low_value_pool"
    else
                           "diminishing_value"
    end

    create_depreciation_profile!(
      depreciable_cost: purchase_price,
      depreciation_start_date: purchase_date || Date.current,
      book_method: "straight_line",
      tax_method: default_tax_method,
      effective_life_years: default_effective_life,
      is_division_43: property?
    )
  rescue => e
    Rails.logger.error "Failed to create default depreciation profile: #{e.message}"
  end

  # Default effective life based on asset type
  def default_effective_life
    case asset_type
    when "vehicle" then 8.0
    when "equipment" then 10.0
    when "property" then 40.0
    else 10.0
    end
  end

  def create_activity
    # Skip activity creation for bulk imports
    return if Rails.env.development? && caller.any? { |line| line.include?("import") }

    user = (defined?(Current) && Current.respond_to?(:user) ? Current.user : nil) || User.first
    corporate_company.corporate_company_activities.create!(
      activity_type: "asset_added",
      description: "Asset added: #{display_name}",
      change_details: { asset_id: id, asset_type: asset_type, purchase_price: purchase_price },
      user: user
    )
  rescue => e
    Rails.logger.error "Failed to create asset activity: #{e.message}"
  end

  def create_update_activity
    return unless saved_changes.any?
    # Skip activity creation for bulk imports
    return if Rails.env.development? && caller.any? { |line| line.include?("import") }

    user = (defined?(Current) && Current.respond_to?(:user) ? Current.user : nil) || User.first

    if saved_change_to_status? && status == "disposed"
      corporate_company.corporate_company_activities.create!(
        activity_type: "asset_disposed",
        description: "Asset disposed: #{display_name}",
        change_details: { asset_id: id },
        user: user
      )
    else
      corporate_company.corporate_company_activities.create!(
        activity_type: "asset_updated",
        description: "Asset updated: #{display_name}",
        change_details: { asset_id: id, changes: saved_changes.except("updated_at") },
        user: user
      )
    end
  rescue => e
    Rails.logger.error "Failed to create asset update activity: #{e.message}"
  end
end
