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
# - CorporateGroup: Business grouping (companies, directors, shareholders)
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

  # Settings
  has_one :tenant_setting, dependent: :destroy

  # Business groupings (CorporateGroup now belongs_to Tenant)
  has_many :corporate_groups, dependent: :destroy

  # Users
  has_many :users, dependent: :nullify

  # Credentials (absorbed from Organization)
  has_many :microsoft_credentials, dependent: :destroy
  has_many :s3_compatible_credentials, dependent: :destroy
  has_many :organization_microsoft_app_credentials, dependent: :destroy

  # Storage configuration (absorbed from Organization)
  has_one :storage_configuration, dependent: :destroy
  has_one :backup_configuration, dependent: :destroy
  belongs_to :document_provider_credential, class_name: 'S3CompatibleCredential', optional: true

  # Template packs (for sharing configuration between tenants)
  has_many :template_packs, foreign_key: :source_tenant_id, dependent: :destroy

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
  # Scopes
  # =============================================================================
  scope :active, -> { where(active: true) }
  scope :master_tenant, -> { where(is_master_tenant: true) }
  scope :customer_tenants, -> { where(is_master_tenant: false) }

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
  # Storage Methods (absorbed from Organization)
  # =============================================================================

  # Returns the document storage provider instance for this tenant
  def document_storage
    @document_storage ||= DocumentProviders.for_tenant(self)
  end

  # Get or create storage configuration for this tenant
  def storage_config
    storage_configuration || StorageConfiguration.for_tenant(self)
  end

  # Check if S3-compatible storage is enabled
  def s3_storage_enabled?
    document_provider == 's3_compatible' && document_provider_credential.present?
  end

  # Check if SharePoint storage is enabled (default)
  def sharepoint_storage_enabled?
    document_provider == 'sharepoint' || document_provider.nil?
  end

  private

  def generate_slug
    self.slug ||= name&.parameterize
  end
end
