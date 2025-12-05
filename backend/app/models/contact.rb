class Contact < ApplicationRecord
  # Exclude soft-deleted contacts by default
  default_scope { where(deleted: [false, nil]) }

  # Associations
  has_many :contact_activities, dependent: :destroy
  has_many :sms_messages, dependent: :destroy

  # Company group for document filing (family members)
  belongs_to :company_group, optional: true

  # Xero-related associations
  has_many :contact_persons, dependent: :destroy
  has_many :contact_addresses, dependent: :destroy
  has_many :contact_group_memberships, dependent: :destroy
  has_many :contact_groups, through: :contact_group_memberships
  has_many :external_links, class_name: 'ContactExternalLink', dependent: :destroy
  has_many :xero_links, -> { where(source: 'xero') }, class_name: 'ContactExternalLink', dependent: :destroy
  has_many :external_invoices, dependent: :nullify

  # Enable nested attributes for Xero associations
  accepts_nested_attributes_for :contact_persons, allow_destroy: true
  accepts_nested_attributes_for :contact_addresses, allow_destroy: true

  # Supplier-specific associations (when contact is a supplier)
  # After migration, supplier_id in these tables points to contact_id
  has_many :pricebook_items, foreign_key: :supplier_id, dependent: :destroy
  has_many :default_pricebook_items, class_name: 'PricebookItem', foreign_key: :default_supplier_id, dependent: :nullify
  has_many :purchase_orders, foreign_key: :supplier_id, dependent: :restrict_with_error
  has_many :price_histories, foreign_key: :supplier_id, dependent: :destroy

  # Contact relationships (bidirectional)
  has_many :outgoing_relationships, class_name: 'ContactRelationship',
           foreign_key: :source_contact_id, dependent: :destroy
  has_many :incoming_relationships, class_name: 'ContactRelationship',
           foreign_key: :related_contact_id, dependent: :destroy
  has_many :related_contacts, through: :outgoing_relationships, source: :related_contact

  # Primary company relationship (person works for company)
  belongs_to :primary_company, class_name: 'Contact', optional: true
  has_many :employees, class_name: 'Contact', foreign_key: :primary_company_id, dependent: :nullify

  # Construction/Job associations
  has_many :job_contacts, dependent: :destroy
  has_many :jobs, through: :job_contacts

  # Portal-related associations
  has_one :portal_user, dependent: :destroy
  has_many :maintenance_requests, foreign_key: :supplier_contact_id, dependent: :destroy

  # Subcontractor-related associations
  has_one :subcontractor_account, through: :portal_user
  has_many :quote_responses, dependent: :destroy
  has_many :quote_request_contacts, dependent: :destroy
  has_many :quote_requests, through: :quote_request_contacts
  has_one :accounting_integration, dependent: :destroy
  has_many :subcontractor_invoices, dependent: :destroy
  has_many :pay_now_requests, dependent: :destroy

  # Corporate director/shareholder associations
  has_many :company_directorships, class_name: 'CompanyDirector', dependent: :destroy
  has_many :directed_companies, through: :company_directorships, source: :company
  has_many :current_directorships, -> { where(is_current: true) }, class_name: 'CompanyDirector'
  has_many :company_shareholdings, foreign_key: :shareholder_id, dependent: :destroy
  has_many :shareholding_companies, through: :company_shareholdings, source: :company
  has_many :dividend_payments, foreign_key: :shareholder_id, dependent: :destroy

  # Personal documents (for family members, directors, etc.)
  has_many :company_documents, dependent: :destroy

  # Company Group memberships (SSoT - links contact to company groups with permissions)
  has_many :company_group_memberships, class_name: 'ContactCompanyGroupMembership', dependent: :destroy
  has_many :company_groups_via_membership, through: :company_group_memberships, source: :company_group

  # SSoT - if this contact is a company/trust, link to the Company record
  has_one :company_record, class_name: 'Company', foreign_key: 'contact_id', dependent: :nullify

  # Encrypted TFN for directors
  encrypts :tfn, deterministic: true

  # Constants
  CONTACT_TYPES = %w[customer supplier sales land_agent corporate default_supplier].freeze
  ENTITY_TYPES = %w[person company trust].freeze
  EMPLOYMENT_STATUSES = %w[active contractor inactive].freeze

  # Xero-synced accounting fields - READ ONLY in TEEEM (synced from Xero)
  # These fields should only be updated via Xero sync, not manual edits
  XERO_READ_ONLY_FIELDS = %w[
    accounts_payable_outstanding
    accounts_payable_overdue
    accounts_receivable_outstanding
    accounts_receivable_overdue
    bank_bsb
    bank_account_number
    bank_account_name
    default_purchase_account
    default_sales_account
    bill_due_day
    bill_due_type
    sales_due_day
    sales_due_type
    default_discount
    xero_account_number
    xero_contact_number
    xero_contact_status
    company_number
  ].freeze

  # Validations
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }
  validate :contact_types_must_be_valid
  # Note: primary_contact_type column removed - use contact_types[0] instead

  # Callbacks
  before_save :update_xero_synced_status
  before_save :generate_full_name
  before_save :sync_company_name_or_trust

  # Scopes
  scope :with_email, -> { where.not(email: [nil, '']) }
  scope :with_phone, -> { where.not(mobile_phone: [nil, '']).or(where.not(office_phone: [nil, ''])) }
  scope :with_type, ->(type) { where("? = ANY(contact_types)", type) }
  scope :customers, -> { with_type('customer') }
  scope :suppliers, -> { with_type('supplier') }
  scope :sales, -> { with_type('sales') }
  scope :land_agents, -> { with_type('land_agent') }

  # Entity type scopes
  scope :people, -> { where(entity_type: 'person') }
  scope :companies, -> { where(entity_type: 'company') }
  scope :trusts, -> { where(entity_type: 'trust') }

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

  # Entity type helpers
  def is_person?
    entity_type == 'person' || contact_types&.include?('person')
  end

  def is_company?
    entity_type == 'company' || contact_types&.include?('company')
  end

  def is_trust?
    entity_type == 'trust' || contact_types&.include?('trust')
  end

  # Family/Director helpers
  def is_director?
    current_directorships.any?
  end

  def director_companies
    current_directorships.includes(:company).map(&:company)
  end

  # Company/Employment relationship helpers
  def all_companies
    companies = []
    companies << primary_company if primary_company.present?
    companies += additional_companies.to_a
    companies.uniq
  end

  def additional_companies
    outgoing_relationships
      .where(relationship_type: ['director_of', 'shareholder_of', 'trustee_of', 'employee_of', 'partner_in'])
      .includes(:related_contact)
      .map(&:related_contact)
  end

  def employers
    companies = []
    companies << primary_company if primary_company.present?
    companies += outgoing_relationships
      .where(relationship_type: 'employee_of')
      .includes(:related_contact)
      .map(&:related_contact)
    companies.uniq
  end

  def directors_of
    outgoing_relationships
      .where(relationship_type: 'director_of')
      .includes(:related_contact)
      .map(&:related_contact)
  end

  def shareholders_of
    outgoing_relationships
      .where(relationship_type: 'shareholder_of')
      .includes(:related_contact)
      .map(&:related_contact)
  end

  def company_group_memberships_count
    company_group_memberships.count
  end

  def trustees_of
    outgoing_relationships
      .where(relationship_type: 'trustee_of')
      .includes(:related_contact)
      .map(&:related_contact)
  end

  # Job/Construction helpers
  def all_jobs_with_roles
    job_contacts.includes(:job).map do |jc|
      {
        job: jc.job,
        role: jc.role,
        primary: jc.primary
      }
    end
  end

  def primary_jobs
    job_contacts.where(primary: true).includes(:job).map(&:job)
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
    teeem_rating&.round(2)
  end

  def rating_summary
    {
      average: teeem_rating&.round(2),
      total_ratings: total_ratings_count
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

  # Xero sync helpers
  def synced_to_xero?
    xero_links.enabled.any?
  end

  def xero_tenants
    xero_links.enabled.pluck(:tenant_id)
  end

  def xero_link_for_tenant(tenant_id)
    xero_links.find_by(tenant_id: tenant_id)
  end

  def has_xero_conflicts?
    xero_links.with_conflicts.any?
  end

  def has_xero_errors?
    xero_links.with_errors.any?
  end

  # ABN validation helpers
  def abn_verified?
    abn_verified_at.present? && abn_valid == true
  end

  def abn_needs_verification?
    tax_number.present? && abn_verified_at.nil?
  end

  def formatted_abn
    return nil if tax_number.blank?
    AbrApiService.format(tax_number)
  end

  # Verify ABN against ABR API
  def verify_abn!
    return if tax_number.blank?

    service = AbrApiService.new
    result = service.lookup(tax_number)

    update!(
      abn_valid: result[:valid],
      abn_entity_name: result[:entity_name],
      abn_entity_type: result[:entity_type_description],
      abn_gst_registered: result[:gst_registered],
      abn_verified_at: Time.current
    )

    result
  rescue AbrApiService::InvalidAbnFormat => e
    update!(
      abn_valid: false,
      abn_verified_at: Time.current
    )
    raise e
  rescue AbrApiService::AbnNotFound => e
    update!(
      abn_valid: false,
      abn_verified_at: Time.current
    )
    raise e
  end

  # Check ABN format only (no API call)
  def abn_format_valid?
    return false if tax_number.blank?
    AbrApiService.valid_format?(tax_number)
  end

  # Check if contact can be deleted (for Xero sync)
  def can_delete?
    # Can't delete if has linked jobs, invoices, purchase orders, etc.
    return false if jobs.any?
    return false if purchase_orders.any?
    return false if subcontractor_invoices.any?
    return false if quote_responses.any?
    true
  end

  def deletion_blockers
    blockers = []
    blockers << "#{jobs.count} jobs" if jobs.any?
    blockers << "#{purchase_orders.count} purchase orders" if purchase_orders.any?
    blockers << "#{subcontractor_invoices.count} invoices" if subcontractor_invoices.any?
    blockers << "#{quote_responses.count} quote responses" if quote_responses.any?
    blockers
  end

  # Relationship summary for search results
  def relationship_summary
    relationships = []

    outgoing_relationships.includes(:related_contact).each do |rel|
      type_label = rel.relationship_type.humanize.titleize
      company_name = rel.related_contact&.display_name
      if rel.ownership_percentage.present?
        relationships << "#{type_label} (#{rel.ownership_percentage}%) of #{company_name}"
      else
        relationships << "#{type_label} #{company_name}"
      end
    end

    relationships
  end

  private

  def contact_types_must_be_valid
    return if contact_types.blank?

    # Handle both array and JSON string formats
    types = contact_types.is_a?(String) ? (JSON.parse(contact_types) rescue []) : contact_types
    return if types.blank?

    invalid_types = types - CONTACT_TYPES
    if invalid_types.any?
      errors.add(:contact_types, "contains invalid types: #{invalid_types.join(', ')}")
    end
  end

  def update_xero_synced_status
    self.xero_synced = xero_id.present?
  end

  # Auto-generate full_name from first_name + last_name for person contacts
  # For company/trust, full_name is typically set directly
  def generate_full_name
    # Only auto-generate for person entity type when first/last name are present
    if entity_type == 'person' && (first_name.present? || last_name.present?)
      generated = [first_name, last_name].map(&:presence).compact.join(' ')
      self.full_name = generated if generated.present? && full_name.blank?
    end

    # Also update if full_name is explicitly blank/nil but we have name components
    if full_name.blank? && (first_name.present? || last_name.present?)
      self.full_name = [first_name, last_name].map(&:presence).compact.join(' ')
    end
  end

  # Auto-sync company_name_or_trust with full_name for company/trust entity types
  def sync_company_name_or_trust
    if %w[company trust].include?(entity_type) && full_name.present?
      self.company_name_or_trust = full_name if company_name_or_trust.blank?
    end
  end
end
