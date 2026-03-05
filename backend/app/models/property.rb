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

  # Validations
  validates :street_address, presence: true

  # Auto-generate property code
  before_create :generate_property_code, if: -> { property_code.blank? }

  # Scopes
  scope :with_lookups, -> { includes(:property_type, :property_status, :owner_contact) }
  scope :sda, -> { where(sda_enrolled: true) }
  scope :vacant, -> { left_joins(:tenancies).where(tenancies: { id: nil }).or(left_joins(:tenancies).where.not(tenancies: { status: "active" })) }

  # SDA categories as frozen constant
  SDA_CATEGORIES = %w[improved_liveability fully_accessible robust high_physical_support].freeze

  validates :sda_category, inclusion: { in: SDA_CATEGORIES, allow_nil: true }

  def full_address
    [street_address, suburb, state, postcode].compact_blank.join(", ")
  end

  def active_tenancy
    tenancies.find_by(status: "active")
  end

  def sda?
    sda_enrolled?
  end

  private

  def generate_property_code
    max_num = Property.where(tenant_id: tenant_id).maximum(:id) || 0
    self.property_code = "P-#{max_num + 1}"
  end
end
