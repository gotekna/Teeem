class CompanyGroup < ApplicationRecord
  # =============================================================================
  # Business Grouping Model
  # =============================================================================
  # CompanyGroup is for business grouping (companies, directors, shareholders).
  # Multi-tenancy is handled by the Tenant model (SSoT).
  #
  # The tier and environment enums are DEPRECATED and will be removed.
  # Use Tenant.tier and Tenant.environment instead.
  # =============================================================================

  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Belongs to Tenant (multi-tenancy SSoT)
  belongs_to :tenant, optional: true

  # DEPRECATED: Enums for multi-tenancy (moved to Tenant model)
  enum :tier, { shared: 0, dedicated: 1 }, prefix: true
  enum :environment, { staging: 0, beta: 1, production: 2 }, prefix: true

  # =============================================================================
  # Associations
  # =============================================================================

  # Existing associations
  has_many :corporate_companies, class_name: "Corporate", foreign_key: :company_group_id, dependent: :nullify
  has_many :xero_chart_of_accounts, dependent: :destroy
  has_many :reconciliation_reports, dependent: :destroy

  # Contact memberships (SSoT - all contacts linked to this group)
  has_many :contact_memberships, class_name: "ContactCompanyGroupMembership", foreign_key: :company_group_id, dependent: :destroy
  has_many :contacts, through: :contact_memberships

  # Tenant settings (per-tenant configuration)
  has_one :tenant_setting, dependent: :destroy

  # Configuration tables (tenant-scoped)
  has_many :job_types, foreign_key: :company_group_id, dependent: :destroy
  has_many :job_statuses, foreign_key: :company_group_id, dependent: :destroy
  has_many :job_stages, foreign_key: :company_group_id, dependent: :destroy
  has_many :contact_types, foreign_key: :company_group_id, dependent: :destroy
  has_many :document_types, foreign_key: :company_group_id, dependent: :destroy
  has_many :sm_schedule_master_templates, foreign_key: :company_group_id, dependent: :destroy
  has_many :public_holidays, foreign_key: :company_group_id, dependent: :destroy
  # SSoT (Feb 2026): warehouse_folders are accessed via Tenant

  # Business data (tenant-scoped)
  has_many :jobs, foreign_key: :company_group_id, dependent: :destroy
  has_many :sm_schedule_masters, foreign_key: :company_group_id, dependent: :destroy
  has_many :sm_trades, foreign_key: :company_group_id, dependent: :destroy
  has_many :pricebooks, foreign_key: :company_group_id, dependent: :destroy
  has_many :pricebook_categories, foreign_key: :company_group_id, dependent: :destroy
  has_many :purchase_orders, foreign_key: :company_group_id, dependent: :destroy
  has_many :estimates, foreign_key: :company_group_id, dependent: :destroy
  has_many :assets, foreign_key: :company_group_id, dependent: :destroy
  has_many :email_warehouses, foreign_key: :company_group_id, dependent: :destroy

  # Template packs (for sharing configuration between tenants)
  has_many :template_packs, foreign_key: :source_tenant_id, dependent: :destroy

  # =============================================================================
  # Validations
  # =============================================================================
  validates :name, presence: true, uniqueness: true
  validates :slug, uniqueness: true, allow_nil: true

  # =============================================================================
  # Scopes
  # =============================================================================
  scope :active, -> { where(active: true) }
  scope :master_tenant, -> { where(is_master_tenant: true) }
  scope :customer_tenants, -> { where(is_master_tenant: false) }

  def display_name
    name
  end

  def corporate_companies_count
    corporate_companies.count
  end

  # SSoT Entity Queries - get entities by type from this group
  def people_in_group
    contacts.joins(:company_group_memberships)
            .where(contact_company_group_memberships: { company_group_id: id })
            .where(entity_type: "person")
            .distinct
  end

  def companies_in_group
    contacts.joins(:company_group_memberships)
            .where(contact_company_group_memberships: { company_group_id: id })
            .where(entity_type: "company")
            .distinct
  end

  def trusts_in_group
    contacts.joins(:company_group_memberships)
            .where(contact_company_group_memberships: { company_group_id: id })
            .where(entity_type: "trust")
            .distinct
  end

  def all_entities
    {
      companies: companies_in_group,
      trusts: trusts_in_group,
      people: people_in_group
    }
  end

  # Directors in this group (people who are directors of any company in the group)
  def directors
    contact_memberships.directors.active.includes(:contact).map(&:contact).uniq
  end

  # Shareholders in this group
  def shareholders
    contact_memberships.shareholders.active.includes(:contact).map(&:contact).uniq
  end

  # Beneficiaries in this group
  def beneficiaries
    contact_memberships.beneficiaries.active.includes(:contact).map(&:contact).uniq
  end

  # =============================================================================
  # Multi-Tenant Methods
  # =============================================================================

  # SSoT: Master tenant is identified by is_master_tenant flag only (Jan 2026)
  # No hardcoded slug - any tenant can be the master
  def master_tenant?
    is_master_tenant?
  end

  # Get subdomain for this tenant
  def subdomain
    slug&.parameterize || name.parameterize
  end

  # Get login URL for this tenant
  # SSoT: Base domain should come from configuration (Jan 2026)
  def login_url
    base_domain = ENV["APP_DOMAIN"] || "teeem.com.au"
    "https://#{subdomain}.#{base_domain}"
  end

  # Class method to find the master tenant
  # SSoT: Use is_master_tenant flag only, not hardcoded slug (Jan 2026)
  def self.find_master_tenant
    find_by(is_master_tenant: true)
  end

  # Get or create tenant settings for this tenant
  def settings
    tenant_setting || build_tenant_setting
  end

  # Check if tenant is in production environment
  def production?
    environment_production?
  end

  # Check if tenant is a paying customer (not master tenant)
  def paying_customer?
    !master_tenant? && environment_production?
  end
end
