class Tenancy < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :sda_participant_contact, class_name: "Contact", optional: true
  belongs_to :rent_recurring_invoice, class_name: "Gl::RecurringInvoice", optional: true
  belongs_to :sda_recurring_invoice, class_name: "Gl::RecurringInvoice", optional: true

  has_many :property_bills, dependent: :nullify
  has_many :property_inspections, dependent: :nullify
  has_many :sda_agreements, dependent: :nullify
  has_many :sda_claims, dependent: :nullify
  has_many :sda_incidents, dependent: :nullify
  has_many :sda_rent_ledger_entries, dependent: :nullify
  has_many :sda_arrears, dependent: :destroy

  # Validations
  validates :tenancy_type, presence: true, inclusion: { in: %w[fixed_term periodic sda] }
  validates :status, presence: true, inclusion: { in: %w[draft active expiring expired terminated] }
  validates :start_date, presence: true
  validates :weekly_rent, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :rent_frequency, presence: true, inclusion: { in: %w[weekly fortnightly monthly] }
  validates :sda_participant_contact, presence: true, if: -> { tenancy_type == "sda" }

  validate :end_date_after_start_date

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :expiring_soon, -> { where(status: "active").where("end_date <= ?", 60.days.from_now) }
  scope :sda, -> { where(tenancy_type: "sda") }

  # Tenancy types
  TYPES = %w[fixed_term periodic sda].freeze
  STATUSES = %w[draft active expiring expired terminated].freeze
  RENT_FREQUENCIES = %w[weekly fortnightly monthly].freeze

  def sda?
    tenancy_type == "sda"
  end

  def active?
    status == "active"
  end

  def expired?
    end_date.present? && end_date < Date.current
  end

  def days_remaining
    return nil unless end_date
    (end_date - Date.current).to_i
  end

  private

  def end_date_after_start_date
    return unless start_date && end_date
    errors.add(:end_date, "must be after start date") if end_date <= start_date
  end
end
