# DEPRECATED: This model is being replaced by MicrosoftCredential (SSoT migration)
# Use MicrosoftCredential.delegated_credentials.org_level instead
# Migration: MigrateMicrosoftCredentialsJob
# Removal planned: After MicrosoftCredential is fully adopted
class OrganizationOneDriveCredential < ApplicationRecord
  # Supports MULTIPLE Microsoft 365 tenants (Tekna, 100xBestLife, Homes of Hope, Love Your World)

  # Log deprecation warning (once per class load)
  def self.inherited(subclass)
    warn_deprecation
    super
  end

  def self.warn_deprecation
    return if @deprecation_warned
    @deprecation_warned = true
    Rails.logger.warn "[DEPRECATED] OrganizationOneDriveCredential is deprecated. Use MicrosoftCredential instead."
  end

  belongs_to :connected_by, class_name: "User", optional: true

  # Encrypt sensitive tokens
  encrypts :access_token
  encrypts :refresh_token

  # Validations
  validates :access_token, presence: true
  validates :refresh_token, presence: true
  validates :name, uniqueness: true, allow_nil: true
  # drive_id is optional on create, set when client initializes and gets drive info
  # validates :drive_id, presence: true

  # Scopes
  scope :active, -> { where(is_active: true) }

  # Multi-org support - returns all active credentials
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.active_credentials
    # Try MicrosoftCredential first (SSoT)
    new_creds = MicrosoftCredential.delegated_credentials.org_level.active
    return new_creds if new_creds.any?

    # Fall back to legacy table
    active.order(:name)
  end

  # Legacy singleton pattern - returns first active for backward compatibility
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.active_credential
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    new_cred = MicrosoftCredential.delegated_credentials.org_level.active.first
    return new_cred if new_cred

    # Fall back to legacy table
    active.first
  end

  # Find by organization name
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.find_by_name(name)
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    new_cred = MicrosoftCredential.delegated_credentials.org_level.active.find_by(name: name) ||
               MicrosoftCredential.delegated_credentials.org_level.active.find_by(name: "#{name}_onedrive")
    return new_cred if new_cred

    # Fall back to legacy table
    active.find_by(name: name)
  end

  # Check if any organization has OneDrive connected
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.connected?
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    return true if MicrosoftCredential.delegated_credentials.org_level.connected.any?

    # Fall back to legacy table
    active.any? { |cred| cred.valid_credential? }
  end

  # Check if token is expired or about to expire (within 5 minutes)
  def token_expired?
    return true if token_expires_at.nil?
    token_expires_at <= 5.minutes.from_now
  end

  # Check if credential is valid and usable
  def valid_credential?
    access_token.present? && refresh_token.present? && !token_expired?
  end

  # Get the root folder path for all jobs (SSoT: from CorporateCompanySetting)
  def jobs_root_folder_path
    root_folder_path.presence ||
      CorporateCompanySetting.instance.sharepoint_jobs_path.presence ||
      "TEEEM Jobs"
  end

  # Get folder path for a specific construction/job
  def job_folder_path(construction)
    job_code = construction.id.to_s.rjust(3, "0")
    "#{jobs_root_folder_path}/#{job_code} - #{construction.title}"
  end

  # Deactivate this credential
  def deactivate!
    update!(is_active: false)
  end

  # Update last sync time
  def mark_synced!
    update!(last_synced_at: Time.current)
  end
end
