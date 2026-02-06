# frozen_string_literal: true

# Tenant - THE SSoT for Multi-Tenancy
#
# This model handles multi-tenant isolation for the entire application.
# Each tenant has completely isolated data via acts_as_tenant scoping.
#
# Key responsibilities:
# - Multi-tenancy isolation (acts_as_tenant uses this model)
# - Owns all business data via tenant_id FK
# - Owns credentials (absorbed from Organization)
# - Owns storage configuration (absorbed from Organization)
#
# Separation of concerns:
# - Tenant: Multi-tenancy + credentials + config
# - CompanyGroup: Business grouping (companies, directors, shareholders)
#
# Tier:
# - shared: Multiple tenants share infrastructure
# - dedicated: Tenant has isolated resources
#
# Environment:
# - staging: Development/testing
# - beta: UAT for early adopters
# - production: Live customers
#
class Tenant < ApplicationRecord
  # Document provider options (absorbed from Organization)
  DOCUMENT_PROVIDERS = %w[sharepoint s3_compatible local].freeze

  # Enums
  enum :tier, { shared: 'shared', dedicated: 'dedicated' }, prefix: true
  enum :environment, { staging: 'staging', beta: 'beta', production: 'production' }, prefix: true

  # =============================================================================
  # Associations
  # =============================================================================

  # Billing - the Corporate we invoice for software usage
  belongs_to :billing_company, class_name: 'Corporate', optional: true

  # Settings
  has_one :tenant_setting, dependent: :destroy

  # Business groupings (CompanyGroup now belongs_to Tenant)
  has_many :company_groups, dependent: :destroy
  has_many :corporate_companies, through: :company_groups

  # Organizations (credential isolation within tenant)
  has_many :organizations, dependent: :destroy

  # Users
  has_many :users, dependent: :nullify

  # Credentials (absorbed from Organization)
  has_many :microsoft_credentials, dependent: :destroy
  has_many :s3_compatible_credentials, dependent: :destroy
  has_many :organization_microsoft_app_credentials, dependent: :destroy

  # SSoT: Storage configuration - WarehouseProvider is THE ONE source for provider_type, credential, bucket
  has_one :warehouse_provider, dependent: :destroy
  has_one :backup_configuration, dependent: :destroy
  # DEPRECATED (Feb 2026): Use WarehouseProvider.credential instead
  belongs_to :document_provider_credential, class_name: 'S3CompatibleCredential', optional: true

  # Template packs (for sharing configuration between tenants)
  has_many :template_packs, foreign_key: :source_tenant_id, dependent: :destroy

  # SSoT (Feb 2026): Warehouse folders are tenant-scoped
  has_many :warehouse_folders, dependent: :destroy
  has_many :warehouse_types, dependent: :destroy

  # Onboarding - internal job used for tracking onboarding progress
  belongs_to :onboarding_job, class_name: 'Job', optional: true

  # Import audit logs - track data import history
  has_many :import_audit_logs, dependent: :destroy

  # =============================================================================
  # Validations
  # =============================================================================
  validates :name, presence: true, uniqueness: true
  validates :slug, presence: true, uniqueness: true
  validates :tier, presence: true
  validates :environment, presence: true
  validates :document_provider, inclusion: { in: DOCUMENT_PROVIDERS }, allow_nil: true

  # =============================================================================
  # Callbacks
  # =============================================================================
  before_validation :generate_slug, on: :create

  # =============================================================================
  # Trial Status Constants
  # =============================================================================
  TRIAL_STATUSES = %w[none active expired converted cancelled].freeze

  # =============================================================================
  # Validations
  # =============================================================================
  validates :trial_status, inclusion: { in: TRIAL_STATUSES }, allow_nil: true

  # =============================================================================
  # Scopes
  # =============================================================================
  scope :active, -> { where(active: true) }
  scope :master_tenant, -> { where(is_master_tenant: true) }
  scope :customer_tenants, -> { where(is_master_tenant: false) }

  # Trial scopes
  scope :on_trial, -> { where(trial_status: 'active') }
  scope :trial_expired, -> { where(trial_status: 'expired') }
  scope :trials_expiring_soon, ->(days) {
    on_trial.where('trial_ends_at <= ?', days.days.from_now)
  }
  scope :converted, -> { where(trial_status: 'converted') }

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Find the master TEEEM tenant
  def self.find_master_tenant
    find_by(is_master_tenant: true)
  end

  # Find tenant by name or slug
  def self.find_by_name_or_slug(identifier)
    find_by(slug: identifier) || find_by(name: identifier)
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Check if this is the master TEEEM tenant
  def master_tenant?
    is_master_tenant?
  end

  # Get display name
  def display_name
    name
  end

  # Get subdomain for this tenant
  def subdomain
    slug
  end

  # Get login URL for this tenant
  def login_url
    "https://#{subdomain}.teeem.com.au"
  end

  # Check if tenant is in production environment
  def production?
    environment_production?
  end

  # Check if tenant is a paying customer (not master tenant)
  def paying_customer?
    !master_tenant? && production?
  end

  # Get or create tenant settings
  def settings
    tenant_setting || build_tenant_setting
  end

  # =============================================================================
  # Trial Methods
  # =============================================================================

  # Check if trial is currently active
  def trial_active?
    trial_status == 'active' && trial_ends_at&.future?
  end

  # Check if trial has expired
  def trial_expired?
    trial_status == 'expired' || (trial_status == 'active' && trial_ends_at&.past?)
  end

  # Get days remaining in trial
  def trial_days_remaining
    return nil unless trial_ends_at
    [(trial_ends_at.to_date - Date.current).to_i, 0].max
  end

  # Start a trial period
  def start_trial!(days: 30)
    update!(
      trial_starts_at: Time.current,
      trial_ends_at: days.days.from_now,
      trial_days: days,
      trial_status: 'active'
    )
  end

  # Extend an existing trial
  def extend_trial!(days:)
    new_end_date = (trial_ends_at || Time.current) + days.days
    update!(trial_ends_at: new_end_date, trial_status: 'active')
    new_end_date
  end

  # Mark trial as expired
  def expire_trial!
    update!(trial_status: 'expired')
  end

  # Convert to paid customer
  def convert_to_paid!
    update!(
      trial_status: 'converted',
      converted_at: Time.current
    )
  end

  # Usage metrics aggregation for dashboard
  def usage_stats
    {
      total_users: users.count,
      active_users_today: users.where('last_login_at > ?', 24.hours.ago).count,
      active_users_week: users.where('last_login_at > ?', 7.days.ago).count,
      last_activity: users.maximum(:last_login_at),
      jobs_count: Job.where(tenant_id: id).count,
      contacts_count: Contact.where(tenant_id: id).count
    }
  end

  # =============================================================================
  # Storage Methods (absorbed from Organization)
  # =============================================================================

  # Returns the document storage provider instance for this tenant
  def document_storage
    @document_storage ||= DocumentProviders.for_tenant(self)
  end

  # Get or create storage configuration for this tenant
  def storage_config
    warehouse_provider || WarehouseProvider.for_tenant(self)
  end

  # Check if S3-compatible storage is enabled
  # SSoT (Feb 2026): Uses WarehouseProvider.provider_type
  def s3_storage_enabled?
    warehouse_provider&.provider_type == 's3_compatible' && warehouse_provider&.credential_id.present?
  end

  # Check if SharePoint storage is enabled
  # FRC (Feb 2026): Only true if explicitly configured as sharepoint, not if nil/unconfigured
  def sharepoint_storage_enabled?
    warehouse_provider&.provider_type == 'sharepoint'
  end

  # Check if any storage provider is configured
  def storage_configured?
    warehouse_provider&.provider_type.present?
  end

  # =============================================================================
  # Onboarding Methods
  # =============================================================================

  # Check if onboarding has been started
  def onboarding_started?
    onboarding_started_at.present?
  end

  # Check if onboarding is complete
  def onboarding_complete?
    onboarding_completed_at.present?
  end

  # Check if tenant is currently in onboarding
  def onboarding_in_progress?
    onboarding_started? && !onboarding_complete?
  end

  # Start onboarding process
  def start_onboarding!
    return if onboarding_started?

    update!(onboarding_started_at: Time.current)
  end

  # Complete onboarding process
  def complete_onboarding!
    return if onboarding_complete?

    update!(onboarding_completed_at: Time.current)
  end

  private

  def generate_slug
    self.slug ||= name&.parameterize
  end
end
