# frozen_string_literal: true

# Organization model - Sub-tenant within a Tenant
#
# Organizations are sub-divisions within a Tenant for credential isolation:
#   Tenant (Tekna) → Organizations (Tekna, 100xBestLife, Homes of Hope, Love Your World)
#
# Each organization has its own Microsoft credentials and storage config.
# Multi-tenancy isolation uses Tenant; Organization is for credential scoping.
#
# SSoT (Feb 2026): Storage config (provider_type, credential_id, bucket) is in WarehouseProvider.
# The document_provider and document_provider_credential_id columns are DEPRECATED.
#
class Organization < ApplicationRecord
  # Document provider options (kept for constant reference - SSoT is WarehouseProvider)
  DOCUMENT_PROVIDERS = %w[sharepoint s3_compatible].freeze

  # Parent tenant (SSoT for multi-tenancy)
  belongs_to :tenant

  # Optional link to Corporate (for credential isolation per company)
  belongs_to :corporate, foreign_key: "company_id", optional: true

  # Associations - credentials belong to organizations
  has_many :microsoft_credentials, dependent: :destroy
  has_many :organization_microsoft_app_credentials, dependent: :destroy
  has_many :s3_compatible_credentials, dependent: :destroy
  # DEPRECATED (Feb 2026): Use WarehouseProvider.credential instead
  belongs_to :document_provider_credential, class_name: 'S3CompatibleCredential', optional: true

  # NOTE (Feb 2026): warehouse_provider and backup_configuration moved to Tenant level
  # See WarehouseProvider.for_tenant and BackupConfiguration models

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :slug, presence: true, uniqueness: true
  # DEPRECATED (Feb 2026): document_provider column will be removed - SSoT is WarehouseProvider.provider_type
  validates :document_provider, inclusion: { in: DOCUMENT_PROVIDERS }, allow_nil: true

  # Returns the document storage provider instance for this organization
  # Uses factory pattern to return SharePoint or S3Compatible based on config
  def document_storage
    @document_storage ||= DocumentProviders.for_organization(self)
  end

  # SSoT: Get storage configuration via tenant (Feb 2026 consolidation)
  def storage_config
    WarehouseProvider.for_tenant(tenant)
  end

  # Check if S3-compatible storage is enabled
  # SSoT (Feb 2026): Uses WarehouseProvider.provider_type
  def s3_storage_enabled?
    storage_config&.provider_type == 's3_compatible' && storage_config&.credential_id.present?
  end

  # Check if SharePoint storage is enabled
  # FRC (Feb 2026): Only true if explicitly configured as sharepoint
  def sharepoint_storage_enabled?
    storage_config&.provider_type == 'sharepoint'
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
