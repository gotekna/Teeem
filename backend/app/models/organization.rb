# frozen_string_literal: true

# Organization model - Sub-tenant within a Tenant
#
# Organizations are sub-divisions within a Tenant for credential isolation:
#   Tenant (Tekna) → Organizations (Tekna, 100xBestLife, Homes of Hope, Love Your World)
#
# Each organization has its own Microsoft credentials and storage config.
# Multi-tenancy isolation uses Tenant; Organization is for credential scoping.
#
class Organization < ApplicationRecord
  # Document provider options
  DOCUMENT_PROVIDERS = %w[sharepoint s3_compatible].freeze

  # Parent tenant (SSoT for multi-tenancy)
  belongs_to :tenant

  # Optional link to CorporateCompany (for credential isolation per company)
  belongs_to :corporate_company, optional: true

  # Associations - credentials belong to organizations
  has_many :microsoft_credentials, dependent: :destroy
  has_many :organization_microsoft_app_credentials, dependent: :destroy
  has_many :s3_compatible_credentials, dependent: :destroy
  belongs_to :document_provider_credential, class_name: 'S3CompatibleCredential', optional: true

  # SSoT: Storage configuration for document paths and provider settings
  has_one :warehouse_provider, dependent: :destroy

  # SSoT: Backup configuration for per-tenant backup settings
  has_one :backup_configuration, dependent: :destroy

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :slug, presence: true, uniqueness: true
  validates :document_provider, inclusion: { in: DOCUMENT_PROVIDERS }, allow_nil: false

  # Returns the document storage provider instance for this organization
  # Uses factory pattern to return SharePoint or S3Compatible based on config
  def document_storage
    @document_storage ||= DocumentProviders.for_organization(self)
  end

  # SSoT: Get or create storage configuration for this organization
  def storage_config
    warehouse_provider || WarehouseProvider.for_organization(self)
  end

  # Check if S3-compatible storage is enabled
  def s3_storage_enabled?
    document_provider == 's3_compatible' && document_provider_credential.present?
  end

  # Check if SharePoint storage is enabled (default)
  def sharepoint_storage_enabled?
    document_provider == 'sharepoint'
  end

  # Scopes
  scope :active, -> { where(is_active: true) }

  # Callbacks
  before_validation :generate_slug, on: :create

  # Class methods
  def self.find_by_name_or_slug(identifier)
    find_by(slug: identifier) || find_by(name: identifier)
  end

  private

  def generate_slug
    self.slug ||= name&.parameterize
  end
end
