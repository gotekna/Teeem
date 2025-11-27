class Asset < ApplicationRecord
  # Associations
  belongs_to :company
  has_one :asset_insurance, dependent: :destroy
  has_many :asset_service_histories, dependent: :destroy

  # Active Storage for photos
  has_many_attached :photos

  # Validations
  validates :name, presence: true
  validates :asset_type, inclusion: { in: %w[vehicle equipment property other] }
  validates :status, inclusion: { in: %w[active disposed under_repair] }
  validates :purchase_price, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :current_book_value, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Scopes
  scope :active, -> { where(status: 'active') }
  scope :disposed, -> { where(status: 'disposed') }
  scope :vehicles, -> { where(asset_type: 'vehicle') }
  scope :equipment, -> { where(asset_type: 'equipment') }
  scope :property, -> { where(asset_type: 'property') }
  scope :by_type, ->(type) { where(asset_type: type) }

  # Callbacks
  after_create :create_activity
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
    status == 'active'
  end

  def has_insurance?
    asset_insurance.present? && asset_insurance.status == 'active'
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

  private

  def create_activity
    company.company_activities.create!(
      activity_type: 'asset_added',
      description: "Asset added: #{display_name}",
      metadata: { asset_id: id, asset_type: asset_type, purchase_price: purchase_price },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def create_update_activity
    return unless saved_changes.any?

    if saved_change_to_status? && status == 'disposed'
      company.company_activities.create!(
        activity_type: 'asset_disposed',
        description: "Asset disposed: #{display_name}",
        metadata: { asset_id: id },
        performed_by: Current.user || User.first,
        occurred_at: Time.current
      )
    else
      company.company_activities.create!(
        activity_type: 'asset_updated',
        description: "Asset updated: #{display_name}",
        metadata: { asset_id: id, changes: saved_changes.except('updated_at') },
        performed_by: Current.user || User.first,
        occurred_at: Time.current
      )
    end
  end
end
