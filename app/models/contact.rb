class Contact < ApplicationRecord
  # Associations
  has_many :suppliers, dependent: :nullify  # Legacy association - will be deprecated
  has_many :supplier_contacts, dependent: :destroy
  has_many :linked_suppliers, through: :supplier_contacts, source: :supplier
  has_many :contact_activities, dependent: :destroy
  has_many :sms_messages, dependent: :destroy

  # Xero-related associations
  has_many :contact_persons, dependent: :destroy
  has_many :contact_addresses, dependent: :destroy
  has_many :contact_group_memberships, dependent: :destroy
  has_many :contact_groups, through: :contact_group_memberships

  # Enable nested attributes for Xero associations
  accepts_nested_attributes_for :contact_persons, allow_destroy: true
  accepts_nested_attributes_for :contact_addresses, allow_destroy: true

  # Supplier-specific associations (when contact is a supplier)
  # After migration, supplier_id in these tables points to contact_id
  has_many :pricebook_items, foreign_key: :supplier_id, dependent: :destroy
  has_many :purchase_orders, foreign_key: :supplier_id, dependent: :restrict_with_error
  has_many :price_histories, foreign_key: :supplier_id, dependent: :destroy

  # Contact relationships (bidirectional)
  has_many :outgoing_relationships, class_name: 'ContactRelationship',
           foreign_key: :source_contact_id, dependent: :destroy
  has_many :incoming_relationships, class_name: 'ContactRelationship',
           foreign_key: :related_contact_id, dependent: :destroy
  has_many :related_contacts, through: :outgoing_relationships, source: :related_contact

  # Portal-related associations
  has_one :portal_user, dependent: :destroy
  has_many :supplier_ratings, dependent: :destroy
  has_many :maintenance_requests, foreign_key: :supplier_contact_id, dependent: :destroy

  # Subcontractor-related associations
  has_one :subcontractor_account, through: :portal_user
  has_many :quote_responses, dependent: :destroy
  has_many :quote_request_contacts, dependent: :destroy
  has_many :quote_requests, through: :quote_request_contacts
  has_one :accounting_integration, dependent: :destroy
  has_many :subcontractor_invoices, dependent: :destroy
  has_many :pay_now_requests, dependent: :destroy

  # Constants
  CONTACT_TYPES = %w[customer supplier sales land_agent].freeze

  # Validations
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }
  validate :contact_types_must_be_valid
  validates :primary_contact_type, inclusion: { in: CONTACT_TYPES }, allow_nil: true
  before_save :set_primary_contact_type_if_blank

  # Scopes
  scope :with_email, -> { where.not(email: [nil, '']) }
  scope :with_phone, -> { where.not(mobile_phone: [nil, '']).or(where.not(office_phone: [nil, ''])) }
  scope :with_type, ->(type) { where("? = ANY(contact_types)", type) }
  scope :customers, -> { with_type('customer') }
  scope :suppliers, -> { with_type('supplier') }
  scope :sales, -> { with_type('sales') }
  scope :land_agents, -> { with_type('land_agent') }

  # Instance methods
  def display_name
    full_name.presence || "#{first_name} #{last_name}".strip.presence || email || "Contact ##{id}"
  end

  def primary_phone
    mobile_phone.presence || office_phone
  end

  def has_contact_info?
    email.present? || mobile_phone.present? || office_phone.present?
  end

  def is_customer?
    contact_types&.include?('customer')
  end

  def is_supplier?
    contact_types&.include?('supplier')
  end

  def is_sales?
    contact_types&.include?('sales')
  end

  def is_land_agent?
    contact_types&.include?('land_agent')
  end

  # Supplier-specific helper methods
  def supplier_name
    full_name
  end

  def active_pricebook_items_count
    pricebook_items.count
  end

  def total_purchase_orders_count
    purchase_orders.count
  end

  def total_purchase_orders_value
    purchase_orders.sum(:total_price)
  end

  # Portal-specific methods
  def has_portal_access?
    portal_enabled && portal_user.present? && portal_user.active?
  end

  def enable_portal!(portal_type, email: nil, password: nil)
    return if portal_user.present?

    transaction do
      update!(portal_enabled: true)
      PortalUser.create!(
        contact: self,
        email: email || self.email,
        password: password || SecureRandom.alphanumeric(16),
        portal_type: portal_type,
        active: true
      )
    end
  end

  def disable_portal!
    portal_user&.deactivate!
    update!(portal_enabled: false)
  end

  def average_rating
    trapid_rating&.round(2)
  end

  def rating_summary
    {
      average: trapid_rating&.round(2),
      total_ratings: total_ratings_count,
      recent_ratings: supplier_ratings.recent.limit(5)
    }
  end

  def open_maintenance_requests_count
    maintenance_requests.active.count
  end

  # Subcontractor-specific methods
  def is_subcontractor?
    is_supplier? && subcontractor_account.present?
  end

  def enable_subcontractor_access!(invited_by: nil)
    return if subcontractor_account.present?

    transaction do
      # Ensure portal access is enabled first
      unless has_portal_access?
        enable_portal!('supplier')
      end

      # Create subcontractor account
      portal_user.create_subcontractor_account!(invited_by: invited_by)
    end
  end

  def kudos_score
    subcontractor_account&.kudos_score || 0
  end

  def pending_quote_requests
    quote_requests.active.pending_response
  end

  def active_jobs
    purchase_orders.where(status: %w[sent received])
  end

  def accounting_connected?
    accounting_integration.present? && accounting_integration.connected?
  end

  private

  def contact_types_must_be_valid
    return if contact_types.blank?

    invalid_types = contact_types - CONTACT_TYPES
    if invalid_types.any?
      errors.add(:contact_types, "contains invalid types: #{invalid_types.join(', ')}")
    end
  end

  def set_primary_contact_type_if_blank
    if primary_contact_type.blank? && contact_types.present?
      self.primary_contact_type = contact_types.first
    end
  end
end
