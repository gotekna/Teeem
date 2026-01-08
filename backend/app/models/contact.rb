class Contact < ApplicationRecord
  include SelfHealing  # Auto-fix formatting issues and earn System kudos
  include Searchable

  # Searchable columns for full-text search (GIN index)
  searchable_columns :first_name, :last_name, :email, :company_name_or_trust, :display_name, :mobile_phone

  # Exclude soft-deleted contacts by default
  # Note: deleted column was removed in migration 20251210093313
  # All contacts are now considered active unless is_active=false
  # default_scope { where(deleted: [ false, nil ]) }

  # Associations
  has_one :user, dependent: :nullify  # Linked user for data sync
  has_many :contact_activities, dependent: :destroy
  has_many :sms_messages, dependent: :destroy

  # Company group for document filing (family members)
  belongs_to :corporate_group, optional: true, foreign_key: "company_group_id"

  # Multiple emails and phones
  has_many :contact_emails, -> { order(:position) }, dependent: :destroy
  has_many :contact_phones, -> { order(:position) }, dependent: :destroy

  # Enable nested attributes for emails and phones
  accepts_nested_attributes_for :contact_emails, allow_destroy: true
  accepts_nested_attributes_for :contact_phones, allow_destroy: true

  # Xero-related associations
  has_many :contact_persons, dependent: :destroy
  has_many :contact_addresses, dependent: :destroy
  has_many :contact_group_memberships, dependent: :destroy
  has_many :contact_groups, through: :contact_group_memberships
  has_many :external_links, class_name: "ContactExternalLink", dependent: :destroy
  has_many :xero_links, -> { where(source: "xero") }, class_name: "ContactExternalLink", dependent: :destroy
  has_many :external_invoices, dependent: :nullify

  # Enable nested attributes for Xero associations
  accepts_nested_attributes_for :contact_persons, allow_destroy: true
  accepts_nested_attributes_for :contact_addresses, allow_destroy: true

  # Supplier-specific associations (when contact is a supplier)
  # After migration, supplier_id in these tables points to contact_id
  has_many :pricebook_items, foreign_key: :supplier_id, dependent: :destroy
  has_many :default_pricebook_items, class_name: "PricebookItem", foreign_key: :default_supplier_id, dependent: :nullify
  has_many :purchase_orders, foreign_key: :supplier_id, dependent: :restrict_with_error
  has_many :price_histories, foreign_key: :supplier_id, dependent: :destroy

  # Contact relationships (bidirectional)
  has_many :outgoing_relationships, class_name: "ContactRelationship",
           foreign_key: :source_contact_id, dependent: :destroy
  has_many :incoming_relationships, class_name: "ContactRelationship",
           foreign_key: :related_contact_id, dependent: :destroy
  has_many :related_contacts, through: :outgoing_relationships, source: :related_contact

  # ============================================
  # DEPRECATED: primary_company_id (Legacy Field)
  # ============================================
  # SSoT: Use ContactRelationship with relationship_type="employee_of" instead
  # This column is kept for backwards compatibility but is scheduled for removal.
  # Changes to primary_company_id are automatically synced to ContactRelationship via callbacks.
  # For new code, use:
  #   - employers method (reads from relationships)
  #   - outgoing_relationships.where(relationship_type: "employee_of")
  # See: lib/tasks/ensure_contact_relationships.rake for audit/backfill tools
  belongs_to :primary_company, class_name: "Contact", optional: true, counter_cache: :employees_count
  has_many :employees, class_name: "Contact", foreign_key: :primary_company_id, dependent: :nullify

  # Employment relationships are now handled via ContactRelationship with relationship_type="employee_of"
  # See outgoing_relationships and incoming_relationships associations
  # The old ContactEmployment model has been deprecated in favor of ContactRelationship SSoT

  # Construction/Job associations
  has_many :job_contacts, dependent: :destroy
  has_many :jobs, through: :job_contacts

  # Case associations (legal/investigation cases)
  has_many :case_contacts, dependent: :destroy
  has_many :cases, through: :case_contacts, source: :case_record

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
  has_many :corporate_company_directorships, class_name: "CorporateCompanyDirector", dependent: :destroy
  has_many :directed_companies, through: :corporate_company_directorships, source: :corporate_company
  has_many :current_directorships, -> { where(is_current: true) }, class_name: "CorporateCompanyDirector"
  has_many :corporate_company_shareholdings, foreign_key: :shareholder_id, dependent: :destroy
  has_many :shareholding_companies, through: :corporate_company_shareholdings, source: :corporate_company
  has_many :dividend_payments, foreign_key: :shareholder_id, dependent: :destroy

  # Personal documents (for family members, directors, etc.)
  has_many :corporate_company_documents, dependent: :destroy

  # Company Group memberships (SSoT - links contact to company groups with permissions)
  has_many :corporate_group_memberships, class_name: "ContactCorporateGroupMembership", dependent: :destroy
  has_many :corporate_groups_via_membership, through: :corporate_group_memberships, source: :corporate_group

  # SSoT - if this contact is a company/trust, link to the Company record
  has_one :company_record, class_name: "CorporateCompany", foreign_key: "contact_id", dependent: :nullify

  # ============================================
  # SaaS Customer & Referral Associations
  # ============================================
  # Support network: who referred this customer
  belongs_to :support_contact, class_name: "Contact", optional: true  # L1 referrer (20%)
  belongs_to :upline_contact, class_name: "Contact", optional: true   # L2 referrer (10%)

  # Inverse: customers I support
  has_many :l1_referrals, class_name: "Contact", foreign_key: :support_contact_id
  has_many :l2_referrals, class_name: "Contact", foreign_key: :upline_contact_id

  # Billing records for this SaaS customer
  has_many :saas_billing_records, dependent: :destroy

  # Commissions I've earned as a referrer
  has_many :referral_commissions, foreign_key: :referrer_contact_id, dependent: :destroy
  has_many :commissions_as_customer, class_name: "ReferralCommission", foreign_key: :customer_contact_id, dependent: :destroy

  # Support tickets for this SaaS customer
  has_many :support_tickets, -> { where(is_ticket: true) }, class_name: "SmTask", foreign_key: :saas_customer_id

  # Time entries linked to this SaaS customer
  has_many :saas_labour_cost_entries, class_name: "LabourCostEntry", foreign_key: :saas_customer_id
  has_many :saas_site_presence_sessions, class_name: "SitePresenceSession", foreign_key: :saas_customer_id

  # Encrypted TFN for directors
  # NOTE: tfn column was removed in migration 20251210093313
  # TFN is now stored in CorporateCompany.tfn instead
  # encrypts :tfn, deterministic: true

  # Constants
  ROLES = %w[Employee sales land_agent Director Company_Secretary Public_Officer CEO GM Owner].freeze
  # SSoT: Valid entity_type values
  # - person: Individual person
  # - company: Business entity
  # - trust: Trust entity
  # - sole_trader: Individual trading business
  # - price_only: Contact used only for pricebook pricing data (legacy suppliers with no other info)
  ENTITY_TYPES = %w[person company trust sole_trader price_only].freeze
  EMPLOYMENT_STATUSES = %w[active contractor inactive].freeze

  # Alias name to display_name for backwards compatibility
  # Many parts of the codebase reference contact.name but the column is 'display_name'
  alias_attribute :name, :display_name

  # Full name method for person contacts
  def full_name
    [first_name, middle_name, last_name].compact.reject(&:blank?).join(" ").presence || display_name
  end

  # Phone aliases for document templates (SSoT: use contact_phones table)
  def phone
    primary_phone
  end

  def mobile
    primary_mobile
  end

  # Company name alias for document templates
  def company_name
    company_name_or_trust
  end

  # ABN is now the actual column (renamed from tax_number)
  # ACN column also added for Australian Company Number

  # ============================================
  # SSoT: Address Helper Methods
  # ============================================
  # contact_addresses table is the SSoT for all address data.
  # These helper methods read from the SSoT table and provide
  # a uniform interface for document templates and display.
  # Legacy columns (address, city, state, postcode) have been removed.

  # Primary address lookup (cached per request)
  def primary_street_address
    @primary_street_address ||= contact_addresses.find_by(address_type: "STREET") ||
                                 contact_addresses.find_by(is_primary: true) ||
                                 contact_addresses.first
  end

  # Clear cached address (call after modifying contact_addresses)
  def clear_address_cache!
    @primary_street_address = nil
  end

  # Suburb/city - locality name
  def suburb
    primary_street_address&.city
  end

  def city
    primary_street_address&.city
  end

  # State/region
  def state
    primary_street_address&.region
  end

  # Postal code
  def postcode
    primary_street_address&.postal_code
  end

  # Multi-line address text (for legacy compatibility)
  def address
    primary_street_address&.multi_line
  end

  # Address helpers for document templates
  def address_line_1
    primary_street_address&.line1
  end

  def address_line_2
    lines = [
      primary_street_address&.line2,
      primary_street_address&.line3,
      primary_street_address&.line4
    ].compact.reject(&:blank?)
    lines.any? ? lines.join(", ") : nil
  end

  def full_address
    primary_street_address&.display_address
  end

  # ============================================
  # SSoT: Email Helper Methods
  # ============================================
  # contact_emails table is the SSoT for all email data.
  # Legacy 'email' column is deprecated and scheduled for removal.
  # These methods read from the SSoT table.

  # Primary email from contact_emails table (cached per request)
  def primary_email
    @primary_email ||= contact_emails.find_by(is_primary: true)&.email ||
                       contact_emails.first&.email
  end

  # All emails as array
  def all_emails
    contact_emails.pluck(:email)
  end

  # Check if contact has any email
  def has_email?
    contact_emails.exists?
  end

  # Clear cached email (call after modifying contact_emails)
  def clear_email_cache!
    @primary_email = nil
  end

  # ============================================
  # SSoT: Phone Helper Methods
  # ============================================
  # contact_phones table is the SSoT for all phone data.
  # Legacy 'mobile_phone', 'office_phone', 'fax_phone' columns are
  # deprecated and scheduled for removal.
  # These methods read from the SSoT table.

  # Primary mobile phone from contact_phones table (cached per request)
  def primary_mobile
    @primary_mobile ||= contact_phones.where(phone_type: 'mobile').find_by(is_primary: true)&.phone_number ||
                        contact_phones.where(phone_type: 'mobile').first&.phone_number
  end

  # Primary office phone from contact_phones table
  def primary_office_phone
    @primary_office_phone ||= contact_phones.where(phone_type: 'office').find_by(is_primary: true)&.phone_number ||
                              contact_phones.where(phone_type: 'office').first&.phone_number
  end

  # Primary fax from contact_phones table
  def primary_fax
    @primary_fax ||= contact_phones.where(phone_type: 'fax').find_by(is_primary: true)&.phone_number ||
                     contact_phones.where(phone_type: 'fax').first&.phone_number
  end

  # Any phone (preference: mobile > office)
  def primary_phone
    primary_mobile.presence || primary_office_phone
  end

  # Check if contact has any phone
  def has_phone?
    contact_phones.exists?
  end

  # Check if contact has any contact method (email or phone)
  def has_contact_info?
    has_email? || has_phone?
  end

  # Clear all cached phones (call after modifying contact_phones)
  def clear_phone_cache!
    @primary_mobile = nil
    @primary_office_phone = nil
    @primary_fax = nil
  end

  # ============================================
  # SSoT: Override Legacy Column Accessors
  # ============================================
  # These overrides make all reads of legacy columns use SSoT tables.
  # The setters (email=, mobile_phone=, office_phone=) still work and
  # trigger callbacks that sync to SSoT tables.
  # This allows 100+ existing usages to work without modification.

  def email
    primary_email
  end

  def mobile_phone
    primary_mobile
  end

  def office_phone
    primary_office_phone
  end

  def fax_phone
    primary_fax
  end

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
    company_number
  ].freeze

  # Validations
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }
  validate :roles_must_be_valid
  # Note: primary_contact_type column removed - use roles[0] instead

  # Entity type validation
  validates :entity_type, presence: { message: "must be selected" },
                          inclusion: { in: ENTITY_TYPES, allow_nil: true }

  # SSoT: Unique company display_name (prevents duplicates from concurrent syncs)
  # DB-enforced via partial unique index: idx_contacts_unique_company_name
  validates :display_name, uniqueness: {
    case_sensitive: false,
    conditions: -> { where(is_active: true, entity_type: "company") },
    message: "already exists for another company"
  }, if: -> { entity_type == "company" && is_active? }

  # Entity-type specific name validations
  validate :validate_name_fields_for_entity_type
  validate :validate_name_casing          # Block ALL CAPS and lowercase names
  validate :validate_no_email_as_name     # Block email addresses used as names
  validate :validate_team_contact_company # Team contacts must have a company
  validate :validate_primary_company       # Prevent self-reference and ensure company type
  validate :validate_employee_role_company # Employee role requires company link (FRC: dual SSoT systems)

  # Team/supplier configuration validations
  validates :team_size, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :daily_rate_per_person, numericality: { greater_than: 0 }, allow_nil: true

  # Callbacks
  # prepend: true ensures these run BEFORE AutoColumnValidation's validate_column_types
  before_validation :auto_fix_website_url, prepend: true  # Auto-fix website URLs without protocol (MUST run before column type validation)
  before_validation :normalize_entity_type      # Convert "Person" → "person", "Sole Trader" → "sole_trader"
  before_validation :migrate_name_on_entity_type_change  # Migrate names when entity type changes
  before_validation :auto_fix_name_casing       # Auto-fix ALL CAPS and lowercase names
  before_save :generate_display_name
  before_save :sync_company_name_or_trust

  # SSoT: Sync primary_company_id → employee_of relationship
  # This ensures the relationship exists when primary_company is set directly
  after_commit :sync_primary_company_to_relationship, if: :should_sync_primary_company_to_relationship?

  # SSoT: Sync Contact → CorporateCompany for standard contact fields
  # One-way sync: Contact is SSoT for name, email, phone, bank details
  # Two-way sync for ABN: Contact.abn ↔ CorporateCompany.abn
  after_commit :sync_to_corporate_company, if: :should_sync_to_corporate?

  # SSoT: Auto-link unlinked Xero invoices when contact is created/updated
  # If invoice.contact_name matches contact.display_name exactly, link them
  after_commit :auto_link_unlinked_invoices, on: [:create, :update], if: :should_auto_link_invoices?

  # SSoT: Sync mobile_phone to linked user when contact is updated
  after_save :sync_mobile_to_user, if: -> { saved_change_to_mobile_phone? && user.present? }

  # SSoT: Sync legacy email/phone columns to contact_emails/contact_phones tables
  # This ensures SSoT tables stay in sync when legacy columns are updated (e.g., from Xero sync)
  after_save :sync_legacy_email_to_ssot, if: -> { saved_change_to_email? }
  after_save :sync_legacy_phones_to_ssot, if: -> { saved_change_to_mobile_phone? || saved_change_to_office_phone? || saved_change_to_fax_phone? }

  # Scopes
  # SSoT: Scopes using contact_emails and contact_phones tables
  scope :with_email, -> { joins(:contact_emails).distinct }
  scope :with_phone, -> { joins(:contact_phones).distinct }
  scope :without_email, -> { left_joins(:contact_emails).where(contact_emails: { id: nil }) }
  scope :without_phone, -> { left_joins(:contact_phones).where(contact_phones: { id: nil }) }
  scope :without_contact_info, -> { without_email.without_phone }

  # SSoT: Find contact by email through contact_emails table
  # Use this instead of Contact.find_by(email: ...) since email is not a column
  def self.find_by_email(email)
    return nil if email.blank?
    joins(:contact_emails).where("LOWER(contact_emails.email) = ?", email.downcase).first
  end
  # Note: roles is TEXT storing JSON array like '["Employee"]', so use LIKE pattern
  # The pattern matches the role surrounded by quotes to avoid partial matches
  scope :with_role, ->(role) { where("roles LIKE ?", "%\"#{role}\"%") }
  scope :employees, -> { with_role("Employee") }
  scope :directors, -> { with_role("Director") }
  scope :sales, -> { with_role("sales") }
  scope :land_agents, -> { with_role("land_agent") }

  # Entity type scopes
  scope :people, -> { where(entity_type: "person") }
  scope :companies, -> { where(entity_type: "company") }
  scope :trusts, -> { where(entity_type: "trust") }

  # Team contact scopes
  scope :team_contacts, -> { where(is_team_contact: true) }
  scope :individual_contacts, -> { where(is_team_contact: false) }

  # Active status scope (SSoT: is_active column)
  scope :active, -> { where(is_active: true) }

  # ============================================
  # SaaS Customer Scopes
  # ============================================
  scope :saas_customers, -> { where(is_saas_customer: true) }
  scope :active_saas, -> { saas_customers.where(saas_status: "active") }
  scope :trial_saas, -> { saas_customers.where(saas_status: "trial") }
  scope :churned_saas, -> { saas_customers.where(saas_status: "churned") }

  # Referrer scopes
  scope :referrers, -> { where.not(referrer_status: "pending") }
  scope :eligible_referrers, -> { where(referrer_status: %w[eligible_l1 eligible_l2]) }
  scope :l1_eligible_referrers, -> { where(referrer_status: %w[eligible_l1 eligible_l2]) }
  scope :l2_eligible_referrers, -> { where(referrer_status: "eligible_l2") }
  scope :trained_referrers, -> { where.not(referrer_training_completed_at: nil) }

  # Instance methods
  # computed_display_name: Generates a display-friendly name based on entity type
  # Note: display_name is now a database column (SSoT), this method computes the value
  def computed_display_name
    raw_display_name = read_attribute(:display_name)
    case entity_type
    when "person"
      # Team contact: append company name for clarity
      if is_team_contact && primary_company.present?
        person_name = [ first_name, middle_name, last_name ].compact.reject(&:blank?).join(" ").presence ||
                      raw_display_name.presence ||
                      email
        company_name = primary_company.company_name_or_trust.presence || primary_company.read_attribute(:display_name)
        "#{person_name} - #{company_name}"
      else
        # Person: prefer first + middle + last, fall back to display_name
        [ first_name, middle_name, last_name ].compact.reject(&:blank?).join(" ").presence ||
          raw_display_name.presence ||
          email ||
          "Contact ##{id}"
      end
    when "sole_trader"
      # Sole Trader: prefer business name, fall back to person name
      company_name_or_trust.presence ||
        [ first_name, middle_name, last_name ].compact.reject(&:blank?).join(" ").presence ||
        raw_display_name.presence ||
        "Contact ##{id}"
    when "company", "trust"
      # Company/Trust: prefer company_name_or_trust, fall back to display_name
      company_name_or_trust.presence ||
        raw_display_name.presence ||
        "Contact ##{id}"
    when "price_only"
      # Price Only: Contact used only for pricebook pricing (e.g., web scraping, legacy data)
      raw_display_name.presence ||
        "Contact ##{id}"
    else
      # NULL or unknown entity_type: basic fallback
      raw_display_name.presence ||
        "Contact ##{id}"
    end
  end

  # Override display_name to use computed_display_name for team contacts
  # This ensures team contacts show "Person Name - Company Name" in all contexts
  def display_name
    if is_team_contact && primary_company.present?
      computed_display_name
    else
      read_attribute(:display_name)
    end
  end

  def primary_phone
    mobile_phone.presence || office_phone
  end

  def has_contact_info?
    email.present? || mobile_phone.present? || office_phone.present?
  end

  # Return roles as an array (handles JSON string storage)
  # SSoT: roles column is TEXT storing JSON like '["Employee"]'
  def roles_array
    return [] if roles.blank?
    return roles if roles.is_a?(Array)
    JSON.parse(roles) rescue []
  end

  # Generic role checker
  def has_role?(role)
    roles_array.include?(role)
  end

  # Specific role helpers
  def is_employee?
    has_role?("Employee")
  end

  def is_ceo?
    has_role?("CEO")
  end

  def is_sales?
    has_role?("sales")
  end

  def is_land_agent?
    has_role?("land_agent")
  end

  # SSoT: Use cached columns for performance (updated via callbacks on related models)
  def is_customer?
    is_customer_cached
  end

  def is_supplier?
    is_supplier_cached
  end

  # Calculate task duration from PO amount based on team capacity
  # Formula: ceil(PO Amount / (Team Size × Daily Rate))
  # Returns nil if team_size not set (use template default instead)
  def calculate_duration_from_amount(po_amount)
    return nil if team_size.blank? || team_size <= 0
    return nil if po_amount.blank? || po_amount <= 0

    rate = daily_rate_per_person || 800.0
    daily_capacity = team_size * rate

    (po_amount.to_f / daily_capacity).ceil
  end

  # Note: is_director? is defined below and checks actual company directorships
  # To check for Director role, use has_role?('Director')

  # Entity type helpers
  def is_person?
    entity_type == "person"
  end

  def is_company?
    entity_type == "company"
  end

  def is_trust?
    entity_type == "trust"
  end

  def is_sole_trader?
    entity_type == "sole_trader"
  end

  # Family/Director helpers
  # SSoT: Use cached column for performance (updated via callbacks on CorporateCompanyDirector)
  def is_director?
    is_director_cached
  end

  # ============================================
  # Cached Boolean Flags (Performance Optimization)
  # ============================================
  # These cached columns avoid expensive EXISTS queries on every request.
  # They're updated via callbacks on related models when data changes.
  # SSoT: is_customer_cached, is_supplier_cached, is_director_cached
  #
  # Call refresh_cached_flags! when related data changes:
  # - JobContact created/destroyed → is_customer_cached
  # - PurchaseOrder/Pricebook/PriceHistory/ExternalInvoice(ACCPAY) created/destroyed → is_supplier_cached
  # - CorporateCompanyDirector created/updated/destroyed → is_director_cached

  # Refresh all cached flags from source data (call after related records change)
  def refresh_cached_flags!
    update_columns(
      is_customer_cached: job_contacts.exists?,
      is_supplier_cached: purchase_orders.exists? ||
                          pricebook_items.exists? ||
                          price_histories.exists? ||
                          external_invoices.bills.exists?,
      is_director_cached: current_directorships.exists?
    )
  end

  # Refresh only customer flag (called by JobContact callbacks)
  def refresh_customer_flag!
    update_column(:is_customer_cached, job_contacts.exists?)
  end

  # Refresh only supplier flag (called by PO/Pricebook/PriceHistory/ExternalInvoice callbacks)
  def refresh_supplier_flag!
    update_column(:is_supplier_cached,
      purchase_orders.exists? ||
      pricebook_items.exists? ||
      price_histories.exists? ||
      external_invoices.bills.exists?
    )
  end

  # Refresh only director flag (called by CorporateCompanyDirector callbacks)
  def refresh_director_flag!
    update_column(:is_director_cached, current_directorships.exists?)
  end

  def director_companies
    current_directorships.includes(:corporate_company).map(&:company)
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
      .where(relationship_type: [ "director_of", "shareholder_of", "trustee_of", "employee_of", "partner_in" ])
      .includes(:related_contact)
      .map(&:related_contact)
  end

  def employers
    companies = []
    companies << primary_company if primary_company.present?
    companies += outgoing_relationships
      .where(relationship_type: "employee_of")
      .includes(:related_contact)
      .map(&:related_contact)
    companies.uniq
  end

  # SSoT: Get employees from ContactRelationship (people who work for this company)
  # This is the inverse of employers - incoming relationships where type is employee_of
  def relationship_employees
    incoming_relationships
      .where(relationship_type: "employee_of", is_active: true)
      .includes(:source_contact)
      .map(&:source_contact)
  end

  # SSoT: Count employees from relationships (overrides counter_cache which may be stale)
  def relationship_employees_count
    incoming_relationships.where(relationship_type: "employee_of", is_active: true).count
  end

  def directors_of
    outgoing_relationships
      .where(relationship_type: "director_of")
      .includes(:related_contact)
      .map(&:related_contact)
  end

  def shareholders_of
    outgoing_relationships
      .where(relationship_type: "shareholder_of")
      .includes(:related_contact)
      .map(&:related_contact)
  end

  def company_group_memberships_count
    corporate_group_memberships.count
  end

  def trustees_of
    outgoing_relationships
      .where(relationship_type: "trustee_of")
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

  # Case helpers
  def case_relationships
    case_contacts
      .includes(:case_record, :added_by)
      .order("case_contacts.created_at DESC")
      .map do |cc|
        {
          id: cc.id,
          case_id: cc.case_id,
          case_number: cc.case_record&.case_number,
          case_title: cc.case_record&.title,
          case_status: cc.case_record&.status,
          relationship_type: cc.relationship_type,
          formatted_relationship_type: cc.formatted_relationship_type,
          alignment: cc.alignment,
          role: cc.role,
          reason: cc.reason,
          notes: cc.notes,
          is_primary: cc.is_primary,
          include_all_emails: cc.include_all_emails,
          added_by: cc.added_by&.name,
          added_at: cc.created_at
        }
      end
  end

  # Supplier-specific helper methods
  def supplier_name
    display_name
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

  # Bill/Invoice helpers (for Xero bills from this supplier)
  def supplier_bills
    external_invoices.bills.active
  end

  def supplier_bills_count
    external_invoices.bills.count
  end

  def supplier_bills_total
    external_invoices.bills.sum(:total)
  end

  def supplier_bills_unpaid
    external_invoices.bills.unpaid.active
  end

  def supplier_bills_unpaid_total
    external_invoices.bills.unpaid.active.sum(:amount_due)
  end

  def supplier_bills_overdue
    external_invoices.bills.unpaid.active.where("due_date < ?", Date.current)
  end

  def supplier_bills_overdue_total
    supplier_bills_overdue.sum(:amount_due)
  end

  # Bill documents (PDFs attached to bills)
  def supplier_bill_documents
    company_documents.where(documentable_type: "ExternalInvoice")
                     .joins("INNER JOIN external_invoices ON external_invoices.id = company_documents.documentable_id")
                     .where("external_invoices.invoice_type = ?", "bill")
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
        enable_portal!("supplier")
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

  # ============================================
  # SSoT: Xero Sync Helpers
  # ============================================
  # contact_external_links table is the SSoT for all Xero connections.
  # A contact can be linked to MULTIPLE Xero tenants (companies).
  # The legacy contacts.xero_id column is deprecated - use xero_links instead.

  # Virtual xero_id - returns the first/primary Xero link's external_contact_id
  # This provides backwards compatibility while the SSoT is xero_links
  def primary_xero_id
    @primary_xero_id ||= xero_links.enabled.order(:created_at).first&.external_contact_id
  end

  # SSoT: Is this contact synced to ANY Xero tenant?
  def synced_to_xero?
    xero_links.enabled.any?
  end

  # Alias for backwards compatibility
  def xero_synced?
    synced_to_xero?
  end

  # Virtual xero_id reader - returns primary_xero_id for backwards compatibility
  # Column dropped - now reads from contact_external_links SSoT
  def xero_id
    primary_xero_id
  end

  # Virtual xero_contact_status reader - returns primary link's status
  # Column dropped - now reads from contact_external_links SSoT
  def xero_contact_status
    xero_links.enabled.order(:created_at).first&.xero_contact_status
  end

  # All Xero tenant IDs this contact is linked to
  def xero_tenants
    xero_links.enabled.pluck(:tenant_id)
  end

  # Update cached xero link columns (called by ContactExternalLink callbacks)
  def update_xero_link_cache!
    links = xero_links.enabled
    update_columns(
      xero_linked_count: links.count,
      xero_tenant_names: links.pluck(:tenant_name).compact
    )
  end

  # Xero link summary for UI display
  # Returns: { linked_count: 3, total_tenants: 10, tenant_names: ["Company A", "Company B"] }
  def xero_link_summary
    links = xero_links.enabled
    {
      linked_count: links.count,
      total_tenants: XeroCredential.count,
      tenant_names: links.pluck(:tenant_name).compact,
      has_sync_errors: links.with_errors.any?,
      has_conflicts: links.with_conflicts.any?,
      last_synced_at: links.maximum(:last_synced_at)
    }
  end

  # Get link for a specific Xero tenant
  def xero_link_for_tenant(tenant_id)
    xero_links.find_by(tenant_id: tenant_id)
  end

  def has_xero_conflicts?
    xero_links.with_conflicts.any?
  end

  def has_xero_errors?
    xero_links.with_errors.any?
  end

  # Xero contact type summary (aggregated from xero_contact_types array)
  # Returns: "Customer" or "Supplier" or "Customer, Supplier" or nil
  def xero_type_display
    return nil if xero_contact_types.blank?
    xero_contact_types.join(", ")
  end

  # Boolean helpers for Xero contact types
  def xero_customer?
    xero_contact_types&.include?("Customer")
  end

  def xero_supplier?
    xero_contact_types&.include?("Supplier")
  end

  # ABN validation helpers
  def abn_verified?
    abn_verified_at.present? && abn_valid == true
  end

  def abn_needs_verification?
    abn.present? && abn_verified_at.nil?
  end

  def formatted_abn
    return nil if abn.blank?
    AbrApiService.format(abn)
  end

  # Verify ABN against ABR API
  def verify_abn!
    return if abn.blank?

    service = AbrApiService.new
    result = service.lookup(abn)

    # Use update_columns to bypass validations (we only update ABN fields)
    update_columns(
      abn_valid: result[:valid],
      abn_entity_name: result[:entity_name],
      abn_entity_type: result[:entity_type_description],
      abn_gst_registered: result[:gst_registered],
      abn_verified_at: Time.current
    )

    result
  rescue AbrApiService::InvalidAbnFormat => e
    update_columns(
      abn_valid: false,
      abn_verified_at: Time.current
    )
    raise e
  rescue AbrApiService::AbnNotFound => e
    update_columns(
      abn_valid: false,
      abn_verified_at: Time.current
    )
    raise e
  end

  # Check ABN format only (no API call)
  def abn_format_valid?
    return false if abn.blank?
    AbrApiService.valid_format?(abn)
  end

  # Check if contact can be deleted (for Xero sync)
  def can_delete?
    # Can't delete if has linked jobs, invoices, purchase orders, Xero links, etc.
    return false if jobs.any?
    return false if purchase_orders.any?
    return false if subcontractor_invoices.any?
    return false if quote_responses.any?
    return false if external_links.xero.any?
    true
  end

  def deletion_blockers
    blockers = []
    blockers << "#{jobs.count} jobs" if jobs.any?
    blockers << "#{purchase_orders.count} purchase orders" if purchase_orders.any?
    blockers << "#{subcontractor_invoices.count} invoices" if subcontractor_invoices.any?
    blockers << "#{quote_responses.count} quote responses" if quote_responses.any?
    blockers << "#{external_links.xero.count} Xero links" if external_links.xero.any?
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

  # Generate folder name for this contact based on company settings
  # Used for document storage in OneDrive/SharePoint
  # @return [String] folder name (e.g., "123 - ABC Supplies" or "ABC Supplies" or "123")
  def document_folder_name
    format = CorporateCompanySetting.instance.contact_folder_format || "id_name"
    # SSoT: Use centralized SharePoint path sanitization
    sanitized_name = SharePoint::FilenameSanitizer.sanitize_path_segment(display_name || "Unknown")

    case format
    when "id_name"
      "#{id} - #{sanitized_name}"
    when "name_only"
      sanitized_name
    when "id_only"
      id.to_s
    else
      "#{id} - #{sanitized_name}"
    end
  end

  # Class method to generate folder name for a contact
  # Useful when you only have the ID and display_name
  def self.generate_folder_name(contact_id:, display_name:, format: nil)
    format ||= CorporateCompanySetting.instance.contact_folder_format || "id_name"
    # SSoT: Use centralized SharePoint path sanitization
    sanitized_name = SharePoint::FilenameSanitizer.sanitize_path_segment(display_name || "Unknown")

    case format
    when "id_name"
      "#{contact_id} - #{sanitized_name}"
    when "name_only"
      sanitized_name
    when "id_only"
      contact_id.to_s
    else
      "#{contact_id} - #{sanitized_name}"
    end
  end

  # ============================================
  # SaaS Customer Methods
  # ============================================

  # Calculate annual SaaS fee based on tiered pricing
  # @return [Hash] { cost:, effective_rate:, tiers: [] }
  def calculate_saas_fee(turnover = annual_turnover)
    SaasPricingService.calculate(turnover || 0)
  end

  # Convenience method for annual fee amount
  def annual_saas_fee
    calculate_saas_fee[:cost]
  end

  # Convenience method for monthly fee amount
  def monthly_saas_fee
    annual_saas_fee / 12.0
  end

  # Calculate cost-to-serve for a date range
  # Uses LabourCostEntry linked to this customer via saas_customer_id
  def cost_to_serve(start_date = nil, end_date = nil)
    entries = saas_labour_cost_entries
    entries = entries.where("work_date >= ?", start_date) if start_date
    entries = entries.where("work_date <= ?", end_date) if end_date
    entries.sum(:fully_loaded_cost)
  end

  # Calculate customer profitability for a date range
  def customer_profitability(start_date = nil, end_date = nil)
    billing = saas_billing_records
    billing = billing.where("billing_period_start >= ?", start_date) if start_date
    billing = billing.where("billing_period_end <= ?", end_date) if end_date

    revenue = billing.sum(:fee_calculated)
    cost = cost_to_serve(start_date, end_date)
    profit = revenue - cost
    margin = revenue > 0 ? (profit / revenue * 100) : 0

    {
      revenue: revenue,
      cost: cost,
      profit: profit,
      margin: margin.round(2)
    }
  end

  # Support ticket statistics
  def ticket_stats
    {
      total: support_tickets.count,
      open: support_tickets.where(status: %w[not_started started]).count,
      sla_breached: support_tickets.where("sla_resolution_due_at < ? AND status != ?", Time.current, "completed").count
    }
  end

  # ============================================
  # Referrer Methods
  # ============================================

  # Check if referrer is eligible for L1 commissions (20%)
  # Requirements: training completed + not expired + $10k network fees threshold
  def referrer_eligible_for_l1?
    referrer_training_completed_at.present? &&
      referrer_training_expires_at.present? &&
      referrer_training_expires_at > Time.current &&
      total_network_fees >= 10_000
  end

  # Check if referrer is eligible for L2 commissions (10%)
  # Requirements: L1 eligible + $50k network fees threshold
  def referrer_eligible_for_l2?
    referrer_eligible_for_l1? && total_network_fees >= 50_000
  end

  # Calculate total network fees (own fees + L1 referrals + L2 referrals)
  # Performance: Uses SQL SUM instead of loading all records into memory
  def calculate_network_fees
    own_fees = is_saas_customer? ? (annual_saas_fee || 0) : 0
    l1_fees = l1_referrals.saas_customers.sum(:annual_saas_fee) || 0
    l2_fees = l2_referrals.saas_customers.sum(:annual_saas_fee) || 0
    own_fees + l1_fees + l2_fees
  end

  # Update cached network fees and check eligibility
  def update_network_fee_cache!
    new_total = calculate_network_fees
    update_columns(total_network_fees: new_total)
    check_and_update_eligibility!
    new_total
  end

  # Check and update referrer eligibility status
  def check_and_update_eligibility!
    new_status = if referrer_training_completed_at.blank?
                   "pending"
                 elsif referrer_training_expires_at.present? && referrer_training_expires_at < Time.current
                   "pending"  # Training expired
                 elsif total_network_fees >= 50_000
                   "eligible_l2"
                 elsif total_network_fees >= 10_000
                   "eligible_l1"
                 else
                   "training"  # Trained but threshold not met
                 end

    # Update eligibility timestamps if newly eligible
    updates = { referrer_status: new_status }
    if new_status == "eligible_l1" && l1_eligible_at.nil?
      updates[:l1_eligible_at] = Time.current
    end
    if new_status == "eligible_l2" && l2_eligible_at.nil?
      updates[:l2_eligible_at] = Time.current
    end

    update_columns(updates) if updates.any?
    new_status
  end

  # Commission statistics
  def commission_stats
    {
      total_earned: referral_commissions.sum(:commission_amount),
      pending: referral_commissions.where(status: "pending").sum(:commission_amount),
      eligible: referral_commissions.where(status: "eligible").sum(:commission_amount),
      paid: referral_commissions.where(status: "paid").sum(:commission_amount),
      network_size: l1_referrals.saas_customers.count + l2_referrals.saas_customers.count
    }
  end

  # Referral network tree (for visualization)
  def referral_network
    {
      l1_referrals: l1_referrals.saas_customers.map { |c| { id: c.id, name: c.display_name, annual_fee: c.annual_saas_fee } },
      l2_referrals: l2_referrals.saas_customers.map { |c| { id: c.id, name: c.display_name, annual_fee: c.annual_saas_fee } },
      total_network_fees: total_network_fees,
      eligibility: referrer_status
    }
  end

  private

  # SSoT: Sync mobile_phone to linked user
  def sync_mobile_to_user
    return unless user.present?
    return if user.mobile_phone == mobile_phone  # No change needed

    user.update_column(:mobile_phone, mobile_phone)
    Rails.logger.info "[Contact#sync_mobile_to_user] Synced mobile_phone '#{mobile_phone}' to User##{user.id}"
  rescue StandardError => e
    Rails.logger.error "[Contact#sync_mobile_to_user] Failed to sync: #{e.message}"
  end

  # SSoT: Sync legacy email column to contact_emails table
  # Called when legacy 'email' column is updated (e.g., from Xero sync)
  def sync_legacy_email_to_ssot
    return if email.blank?

    # Find or create primary email record
    existing = contact_emails.find_by(is_primary: true) || contact_emails.first

    if existing
      # Update existing primary email if different
      existing.update(email: email) unless existing.email == email
    else
      # Create new primary email
      contact_emails.create!(
        email: email,
        is_primary: true,
        position: 0
      )
    end
    clear_email_cache!
  rescue StandardError => e
    Rails.logger.error "[Contact#sync_legacy_email_to_ssot] Contact##{id}: #{e.message}"
  end

  # SSoT: Sync legacy phone columns to contact_phones table
  # Called when legacy 'mobile_phone', 'office_phone', or 'fax_phone' columns are updated
  def sync_legacy_phones_to_ssot
    sync_legacy_phone_to_ssot(:mobile_phone, 'mobile')
    sync_legacy_phone_to_ssot(:office_phone, 'office')
    sync_legacy_phone_to_ssot(:fax_phone, 'fax')
    clear_phone_cache!
  rescue StandardError => e
    Rails.logger.error "[Contact#sync_legacy_phones_to_ssot] Contact##{id}: #{e.message}"
  end

  def sync_legacy_phone_to_ssot(column_name, phone_type)
    value = send(column_name)
    return if value.blank?

    # Find or create phone record for this type
    existing = contact_phones.find_by(phone_type: phone_type)

    if existing
      # Update existing phone if different
      existing.update(phone_number: value) unless existing.phone_number == value
    else
      # Create new phone - mobile is primary by default, others are not
      contact_phones.create!(
        phone_number: value,
        phone_type: phone_type,
        is_primary: phone_type == 'mobile' && !contact_phones.where(is_primary: true).exists?,
        position: contact_phones.maximum(:position).to_i + 1
      )
    end
  end

  # SSoT: Guard method for syncing primary_company_id to employee_of relationship
  def should_sync_primary_company_to_relationship?
    # Only sync for persons/sole traders (not companies/trusts)
    return false unless %w[person sole_trader].include?(entity_type)
    # Only sync if primary_company_id was changed
    saved_change_to_primary_company_id?
  end

  # SSoT: Create/update employee_of relationship when primary_company_id is set directly
  # This is the reverse of ContactRelationship#sync_primary_company_id
  def sync_primary_company_to_relationship
    # Prevent infinite loop with ContactRelationship callback
    return if Thread.current[:syncing_primary_company_relationship]
    Thread.current[:syncing_primary_company_relationship] = true

    if primary_company_id.present?
      # Create or activate employee_of relationship
      relationship = outgoing_relationships.find_or_initialize_by(
        related_contact_id: primary_company_id,
        relationship_type: "employee_of"
      )
      relationship.is_active = true
      relationship.start_date ||= Date.today
      relationship.save!
    else
      # Deactivate any existing employee_of relationships (primary company was cleared)
      outgoing_relationships
        .where(relationship_type: "employee_of", is_active: true)
        .update_all(is_active: false, end_date: Date.today)
    end
  rescue StandardError => e
    Rails.logger.error("Contact##{id}: SSoT sync primary_company_to_relationship failed - #{e.message}")
  ensure
    Thread.current[:syncing_primary_company_relationship] = false
  end

  def roles_must_be_valid
    return if roles.blank?

    # Handle both array and JSON string formats
    role_list = roles.is_a?(String) ? (JSON.parse(roles) rescue []) : roles
    return if role_list.blank?

    invalid_roles = role_list - ROLES
    if invalid_roles.any?
      errors.add(:roles, "contains invalid roles: #{invalid_roles.join(', ')}")
    end
  end

  def validate_name_fields_for_entity_type
    return if entity_type.blank? # Allow NULL for legacy data (will fix separately)

    case entity_type
    when "person"
      if first_name.blank?
        errors.add(:first_name, "is required for person contacts")
      end
      # last_name is optional (only 30% have it currently)
    when "sole_trader"
      if first_name.blank?
        errors.add(:first_name, "is required for sole trader contacts")
      end
      # company_name_or_trust is optional (their trading/business name)
    when "company", "trust"
      if company_name_or_trust.blank?
        errors.add(:company_name_or_trust, "is required for #{entity_type} contacts")
      end
    when "price_only"
      if display_name.blank?
        errors.add(:display_name, "is required for price-only contacts")
      end
    end
  end

  # Block ALL CAPS and all lowercase names for person contacts
  # Note: auto_fix_name_casing runs before validation to auto-correct
  # This validation only triggers if auto-fix couldn't run (e.g., Xero sync)
  def validate_name_casing
    return unless entity_type == "person"

    # Check first_name (skip single letters - they're fine as caps)
    if first_name.present? && first_name.length > 1
      if first_name == first_name.upcase && first_name != first_name.downcase
        errors.add(:first_name, "cannot be ALL CAPS. Use Title Case (e.g., 'John' not 'JOHN')")
      elsif first_name == first_name.downcase && first_name =~ /[a-z]/
        errors.add(:first_name, "cannot be all lowercase. Use Title Case (e.g., 'John' not 'john')")
      end
    end

    # Check last_name (skip single letters)
    if last_name.present? && last_name.length > 1
      if last_name == last_name.upcase && last_name != last_name.downcase
        errors.add(:last_name, "cannot be ALL CAPS. Use Title Case (e.g., 'Smith' not 'SMITH')")
      elsif last_name == last_name.downcase && last_name =~ /[a-z]/
        errors.add(:last_name, "cannot be all lowercase. Use Title Case (e.g., 'Smith' not 'smith')")
      end
    end
  end

  # Block email addresses used as first_name or last_name
  def validate_no_email_as_name
    if first_name.present? && first_name.include?("@")
      errors.add(:first_name, "cannot be an email address. Use the person's actual first name.")
    end

    if last_name.present? && last_name.include?("@")
      errors.add(:last_name, "cannot be an email address. Use the person's actual last name.")
    end
  end

  # Team contacts (is_team_contact=true) must have a primary_company linked
  def validate_team_contact_company
    if is_team_contact && primary_company_id.blank?
      errors.add(:primary_company, "must be selected for team contacts. A team contact represents a person at a specific company.")
    end
  end

  def validate_primary_company
    return if primary_company_id.blank?

    # Cannot reference self as primary company
    if primary_company_id == id
      errors.add(:primary_company, "cannot be self-referencing")
      return
    end

    # Primary company must exist and be a company/trust type (not person/sole_trader)
    primary = Contact.find_by(id: primary_company_id)
    if primary.nil?
      errors.add(:primary_company, "must exist")
    elsif !%w[company trust].include?(primary.entity_type)
      errors.add(:primary_company, "must be a Company or Trust, not a #{primary.entity_type}")
    end
  end

  # FRC: Employee role requires a company link
  # Root cause: Two systems track employment (roles array vs ContactRelationship) - they must be linked
  # Either primary_company_id must be set, OR an active employee_of relationship must exist
  def validate_employee_role_company
    return unless has_role?("Employee")

    # Check if has primary_company_id
    return if primary_company_id.present?

    # Check if has active employee_of relationship (check persisted relationships only)
    if persisted?
      has_active_employment = outgoing_relationships
        .where(relationship_type: "employee_of", is_active: true)
        .exists?
      return if has_active_employment
    end

    errors.add(:roles, "Employee role requires a primary company or active employment relationship. Either set primary_company or remove Employee from roles.")
  end

  # Legacy update_xero_synced_status callback removed
  # SSoT: Use synced_to_xero? method which queries contact_external_links

  # Auto-generate display_name from first_name + middle_name + last_name for person contacts
  # SSoT: For person/sole_trader, display_name = first_name + middle_name + last_name
  # For company/trust, display_name is synced from company_name_or_trust
  def generate_display_name
    # For person/sole_trader: display_name is derived from first_name + middle_name + last_name
    if entity_type.in?(%w[person sole_trader]) && (first_name.present? || last_name.present?)
      generated = [ first_name, middle_name, last_name ].map(&:presence).compact.join(" ")
      # Always update display_name to match name parts for person contacts
      # This ensures SSoT: first_name + middle_name + last_name = display_name
      self.display_name = generated if generated.present?
    end

    # Fallback: if display_name is blank but we have name components (any entity type)
    if display_name.blank? && (first_name.present? || last_name.present?)
      self.display_name = [ first_name, middle_name, last_name ].map(&:presence).compact.join(" ")
    end
  end

  # Auto-sync company_name_or_trust with display_name for company/trust entity types
  # SSoT: company_name_or_trust is the source of truth for display_name
  # This keeps both fields in sync for backwards compatibility
  def sync_company_name_or_trust
    return unless %w[company trust].include?(entity_type)

    # If company_name_or_trust was changed, update display_name to match
    if company_name_or_trust_changed? && company_name_or_trust.present?
      self.display_name = company_name_or_trust
    # If only display_name was changed (legacy code path), sync to company_name_or_trust
    elsif display_name_changed? && display_name.present? && !company_name_or_trust_changed?
      self.company_name_or_trust = display_name
    # Initial sync: if company_name_or_trust is blank but display_name exists
    elsif company_name_or_trust.blank? && display_name.present?
      self.company_name_or_trust = display_name
    end
  end

  # Auto-fix name casing: convert ALL CAPS or all lowercase to Title Case
  # Only applies to person entity types
  # Skips single-letter names (initials are fine as uppercase)
  def auto_fix_name_casing
    return unless entity_type == "person"

    # Fix first_name if ALL CAPS or all lowercase (skip single letters)
    if first_name.present? && first_name.length > 1
      if all_caps?(first_name) || all_lowercase?(first_name)
        self.first_name = titleize_name(first_name)
      end
    end

    # Fix middle_name if ALL CAPS or all lowercase (skip single letters)
    if middle_name.present? && middle_name.length > 1
      if all_caps?(middle_name) || all_lowercase?(middle_name)
        self.middle_name = titleize_name(middle_name)
      end
    end

    # Fix last_name if ALL CAPS or all lowercase (skip single letters)
    if last_name.present? && last_name.length > 1
      if all_caps?(last_name) || all_lowercase?(last_name)
        self.last_name = titleize_name(last_name)
      end
    end
  end

  # Auto-fix website URL: add https:// if missing protocol
  def auto_fix_website_url
    return if website.blank?

    # Skip if already has http:// or https://
    return if website.start_with?("http://", "https://")

    # Add https:// prefix
    self.website = "https://#{website}"
  end

  # Normalize entity_type to match backend constants
  # Frontend choices: "Person", "Company", "Trust", "Sole Trader", "Price Only"
  # Backend expects:  "person", "company", "trust", "sole_trader", "price_only"
  def normalize_entity_type
    return if entity_type.blank?

    # Convert to lowercase and replace spaces with underscores
    self.entity_type = entity_type.downcase.gsub(" ", "_")
  end

  # Migrate name fields when entity type changes
  # company/trust → person: Move company_name_or_trust → first_name
  # person → company/trust: Move display_name → company_name_or_trust
  def migrate_name_on_entity_type_change
    return unless entity_type_changed?
    return if entity_type.blank?

    old_type = entity_type_was
    new_type = entity_type

    # company/trust → person/sole_trader: Move company name to first name
    if old_type.in?(%w[company trust]) && new_type.in?(%w[person sole_trader])
      if first_name.blank?
        # Use company_name_or_trust or fall back to display_name
        name = company_name_or_trust.presence || display_name.presence
        if name.present?
          self.first_name = name
          self.company_name_or_trust = nil
          # Clear display_name so generate_display_name can rebuild from first+last
          self.display_name = nil
        end
      end
    end

    # person/sole_trader → company/trust: Move display name to company name
    if old_type.in?(%w[person sole_trader]) && new_type.in?(%w[company trust])
      if company_name_or_trust.blank?
        # Use existing display_name or construct from first/last name
        name = display_name.presence || [ first_name, last_name ].compact.join(" ")
        if name.present?
          self.company_name_or_trust = name
          self.first_name = nil
          self.last_name = nil
        end
      end
    end
  end

  private

  # Check if string is ALL CAPS (contains letters and all uppercase)
  def all_caps?(str)
    return false if str.blank?
    str == str.upcase && str != str.downcase
  end

  # Check if string is all lowercase (contains letters and all lowercase)
  def all_lowercase?(str)
    return false if str.blank?
    str == str.downcase && str =~ /[a-z]/
  end

  # Convert name to Title Case, handling apostrophes (e.g., O'Brien)
  def titleize_name(name)
    return name if name.blank?

    name.split(/\s+/).map do |word|
      if word.include?("'")
        word.split("'").map(&:capitalize).join("'")
      else
        word.capitalize
      end
    end.join(" ")
  end

  # SSoT: Check if this contact should sync to CorporateCompany
  def should_sync_to_corporate?
    # Only sync if this is a company/trust with a linked CorporateCompany record
    # Don't sync if we're already syncing from CorporateCompany to Contact (prevent loop)
    entity_type.in?([ "company", "trust" ]) &&
      company_record.present? &&
      !Thread.current[:syncing_company_to_contact]
  end

  # SSoT: Sync Contact → CorporateCompany for standard contact fields
  def sync_to_corporate_company
    # Prevent infinite loops
    return if Thread.current[:syncing_contact_to_company]

    Thread.current[:syncing_contact_to_company] = true

    company_record.update!(
      name: display_name,
      abn: abn  # SelfHealing will format with spaces
    )
  rescue StandardError => e
    Rails.logger.error("Contact##{id}: Sync to CorporateCompany failed - #{e.message}")
  ensure
    Thread.current[:syncing_contact_to_company] = false
  end

  # SSoT: Check if this contact should auto-link unlinked invoices
  def should_auto_link_invoices?
    # Only run if display_name or company_name_or_trust changed (or new record)
    display_name.present? || company_name_or_trust.present?
  end

  # SSoT: Auto-link unlinked Xero invoices when contact is created/updated
  # This ensures that when a user creates a TEEEM contact, existing Xero invoices
  # with matching names are automatically linked (no manual intervention needed)
  def auto_link_unlinked_invoices
    names_to_match = [
      display_name&.strip&.squish&.downcase,
      company_name_or_trust&.strip&.squish&.downcase
    ].compact.reject(&:blank?).uniq

    return if names_to_match.empty?

    # Find unlinked invoices with matching contact_name (case-insensitive, trimmed)
    linked_count = 0
    names_to_match.each do |name|
      count = ExternalInvoice.where(contact_id: nil)
        .where("LOWER(TRIM(contact_name)) = ?", name)
        .update_all(contact_id: id)
      linked_count += count
    end

    if linked_count > 0
      Rails.logger.info("Contact##{id} (#{display_name}): Auto-linked #{linked_count} unlinked Xero invoices")
    end
  rescue StandardError => e
    Rails.logger.error("Contact##{id}: Auto-link invoices failed - #{e.message}")
  end
end
