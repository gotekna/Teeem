# DEPRECATED: This model is being replaced by MicrosoftCredential (SSoT migration)
# Use MicrosoftCredential.delegated_credentials.org_level instead
# Migration: MigrateMicrosoftCredentialsJob
# Removal planned: After MicrosoftCredential is fully adopted
#
# RENAMED: OrganizationOneDriveCredential → OrganizationSharePointCredential
# Alias kept for backwards compatibility
class OrganizationSharePointCredential < ApplicationRecord
  self.table_name = "organization_one_drive_credentials"  # Keep existing table

  # Supports MULTIPLE Microsoft 365 tenants (Tekna, 100xBestLife, Homes of Hope, Love Your World)

  # Log deprecation warning (once per class load)
  def self.inherited(subclass)
    warn_deprecation
    super
  end

  def self.warn_deprecation
    return if @deprecation_warned
    @deprecation_warned = true
    Rails.logger.warn "[DEPRECATED] OrganizationSharePointCredential is deprecated. Use MicrosoftCredential instead."
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
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    # Check delegated credentials
    new_creds = MicrosoftCredential.delegated_credentials.org_level.active
    return new_creds if new_creds.any?

    # Check app credentials
    app_creds = MicrosoftCredential.app_credentials.connected
    return app_creds if app_creds.any?

    # Fall back to legacy table
    active.order(:name)
  end

  # Legacy singleton pattern - returns first active for backward compatibility
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.active_credential
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    # Check delegated credentials first (user OAuth)
    new_cred = MicrosoftCredential.delegated_credentials.org_level.active.first
    return new_cred if new_cred

    # Also check app credentials (client credentials flow - org-level SharePoint access)
    app_cred = MicrosoftCredential.app_credentials.connected.first
    return app_cred if app_cred

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

    # Also check app credentials
    return true if MicrosoftCredential.app_credentials.connected.any?

    # Fall back to legacy table
    active.any? { |cred| cred.valid_credential? }
  end

  # Factory method to get the appropriate Graph client
  # Returns MicrosoftAppGraphClient for app credentials, MicrosoftGraphClient for delegated
  # SSoT Migration: This handles the credential type mismatch during migration
  def self.graph_client
    warn_deprecation

    credential = active_credential
    return nil unless credential

    # If it's a MicrosoftCredential with app type, use MicrosoftAppGraphClient
    if credential.is_a?(MicrosoftCredential) && credential.credential_type == "app"
      MicrosoftAppGraphClient.new(credential)
    else
      # Delegated credentials or legacy credentials use MicrosoftGraphClient
      MicrosoftGraphClient.new(credential)
    end
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

  # Get the root folder path for all jobs (SSoT: from StorageConfiguration)
  def jobs_root_folder_path
    root_folder_path.presence || StorageConfiguration.instance.path_for(:jobs)
  end

  # SSoT: Delegate to StorageConfiguration.job_path for consistent folder naming
  def job_folder_path(construction)
    StorageConfiguration.instance&.job_path(construction.job_number) || "/Jobs/#{construction.job_number}"
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
