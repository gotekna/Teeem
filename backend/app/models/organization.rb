# frozen_string_literal: true

# Organization model - SSoT for multi-org isolation
# Created as part of Microsoft credential org isolation fix
#
# Each organization has its own Microsoft credentials and other resources.
# This model is THE source of truth for organization identity.
class Organization < ApplicationRecord
  # Document provider options
  DOCUMENT_PROVIDERS = %w[sharepoint s3_compatible].freeze

  # Associations - credentials belong to organizations
  has_many :microsoft_credentials, dependent: :destroy
  has_many :organization_microsoft_app_credentials, dependent: :destroy
  belongs_to :document_provider_credential, class_name: 'S3CompatibleCredential', optional: true

  # SSoT: Storage configuration for document paths and provider settings
  has_one :storage_configuration, dependent: :destroy

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
    storage_configuration || StorageConfiguration.for_organization(self)
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
