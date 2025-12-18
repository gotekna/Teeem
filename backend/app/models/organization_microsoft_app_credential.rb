# DEPRECATED: This model is being replaced by MicrosoftCredential (SSoT migration)
# Use MicrosoftCredential.app_credentials instead
# Migration: MigrateMicrosoftCredentialsJob
# Removal planned: After MicrosoftCredential is fully adopted
class OrganizationMicrosoftAppCredential < ApplicationRecord
  # This uses the Client Credentials flow (application permissions)
  # No user interaction needed after admin consent is granted
  # Can access ANY user's mailbox in the tenant
  # Supports MULTIPLE Microsoft 365 tenants (Tekna, 100xBestLife, Homes of Hope, Love Your World)

  # Log deprecation warning (once per class load)
  def self.inherited(subclass)
    warn_deprecation
    super
  end

  def self.warn_deprecation
    return if @deprecation_warned
    @deprecation_warned = true
    Rails.logger.warn "[DEPRECATED] OrganizationMicrosoftAppCredential is deprecated. Use MicrosoftCredential instead."
  end

  belongs_to :setup_by, class_name: "User", optional: true
  has_many :attachments, dependent: :nullify

  # Encrypt sensitive data
  encrypts :client_secret
  encrypts :access_token

  # Validations
  validates :client_id, presence: true
  validates :tenant_id, presence: true
  validates :client_secret, presence: true
  validates :name, presence: true, uniqueness: { scope: :is_active, conditions: -> { where(is_active: true) }, message: "is already used by an active organization" }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :connected, -> { active.where(status: "connected") }

  # Multi-org support - returns all active credentials
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.active_credentials
    # Try MicrosoftCredential first (SSoT)
    new_creds = MicrosoftCredential.app_credentials.active
    return new_creds if new_creds.any?

    # Fall back to legacy table
    active.order(:name)
  end

  # Legacy singleton pattern - returns first active for backward compatibility
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.active_credential
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    new_cred = MicrosoftCredential.app_credentials.active.first
    return new_cred if new_cred

    # Fall back to legacy table
    active.first
  end

  # Find by organization name
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.find_by_name(name)
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    new_cred = MicrosoftCredential.app_credentials.active.find_by(name: name)
    return new_cred if new_cred

    # Fall back to legacy table
    active.find_by(name: name)
  end

  # SSoT Migration: Delegates to MicrosoftCredential
  def self.connected?
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    return true if MicrosoftCredential.app_credentials.connected.any?

    # Fall back to legacy table
    connected.exists?
  end

  # Check if any organization is connected
  # SSoT Migration: Delegates to MicrosoftCredential
  def self.any_connected?
    warn_deprecation

    # Try MicrosoftCredential first (SSoT)
    return true if MicrosoftCredential.app_credentials.connected.any?

    # Fall back to legacy table
    connected.exists?
  end

  # Check if token is expired or about to expire (within 5 minutes)
  def token_expired?
    return true if token_expires_at.nil?
    token_expires_at <= 5.minutes.from_now
  end

  # Get a valid access token, fetching new one if needed
  # Client Credentials flow gets a NEW token each time (no refresh token)
  def valid_access_token
    fetch_access_token! if token_expired?
    access_token
  end

  # Fetch a new access token using Client Credentials flow
  def fetch_access_token!
    response = HTTP.post(
      "https://login.microsoftonline.com/#{tenant_id}/oauth2/v2.0/token",
      form: {
        client_id: client_id,
        client_secret: client_secret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials"
      }
    )

    if response.status.success?
      data = response.parse
      update!(
        access_token: data["access_token"],
        token_expires_at: Time.current + data["expires_in"].to_i.seconds,
        status: "connected",
        last_error: nil
      )
      Rails.logger.info "[MicrosoftApp] Access token fetched successfully for tenant #{tenant_id}"
      true
    else
      error_msg = "Failed to fetch token: #{response.status} - #{response.body}"
      update!(status: "error", last_error: error_msg)
      Rails.logger.error "[MicrosoftApp] #{error_msg}"
      false
    end
  rescue StandardError => e
    update!(status: "error", last_error: e.message)
    Rails.logger.error "[MicrosoftApp] Error fetching token: #{e.message}"
    false
  end

  # Test the connection by making a simple API call
  def test_connection!
    return false unless fetch_access_token!

    # Try to list users to verify Mail.Read permission
    response = HTTP.auth("Bearer #{access_token}")
                   .get("https://graph.microsoft.com/v1.0/users?$top=1&$select=id,mail")

    if response.status.success?
      update!(status: "connected", last_error: nil)
      true
    else
      error_msg = "API test failed: #{response.status} - #{response.body}"
      update!(status: "error", last_error: error_msg)
      false
    end
  rescue StandardError => e
    update!(status: "error", last_error: e.message)
    false
  end

  # Mark as having admin consent
  def mark_admin_consent!(admin_email)
    update!(
      admin_consent_granted_at: Time.current,
      admin_consent_granted_by: admin_email,
      status: "connected"
    )
  end

  # Deactivate this credential (soft delete - keeps record but marks inactive)
  def deactivate!
    update!(is_active: false)
  end

  # Disconnect and clear all credentials
  # This removes all sensitive data until the user grants access again
  def disconnect!
    # Use update_columns to bypass validations (allowing nil values)
    update_columns(
      client_id: nil,
      client_secret: nil,
      tenant_id: nil,
      access_token: nil,
      token_expires_at: nil,
      status: "disconnected",
      is_active: false,
      last_error: nil,
      updated_at: Time.current
    )
  end

  # Get list of users in the tenant (for sync configuration)
  def list_tenant_users
    return [] unless status == "connected"

    response = HTTP.auth("Bearer #{valid_access_token}")
                   .get("https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName")

    if response.status.success?
      data = response.parse
      data["value"].map do |user|
        {
          id: user["id"],
          name: user["displayName"],
          email: user["mail"] || user["userPrincipalName"]
        }
      end
    else
      Rails.logger.error "[MicrosoftApp] Failed to list users: #{response.body}"
      []
    end
  rescue StandardError => e
    Rails.logger.error "[MicrosoftApp] Error listing users: #{e.message}"
    []
  end

  # SharePoint configuration helpers
  # TEEEM's single SharePoint config (all orgs store attachments here)
  # SSoT Migration: Delegates to CorporateCompanySetting
  def self.teeem_sharepoint_config
    warn_deprecation

    # SSoT: Use CorporateCompanySetting for SharePoint config
    setting = CorporateCompanySetting.instance
    return nil unless setting.sharepoint_site_id.present? && setting.sharepoint_drive_id.present?

    {
      site_id: setting.sharepoint_site_id,
      drive_id: setting.sharepoint_drive_id,
      drive_name: setting.sharepoint_drive_name || "Shared Documents",
      credential: active_credential  # Still need a credential for API calls
    }
  end

  # SSoT Migration: Delegates to CorporateCompanySetting
  def self.sharepoint_configured?
    warn_deprecation
    CorporateCompanySetting.instance.sharepoint_site_id.present? &&
      CorporateCompanySetting.instance.sharepoint_drive_id.present?
  end

  # Instance method for backward compatibility
  def sharepoint_configured?
    self.class.sharepoint_configured?
  end

  def attachment_root_path
    # SSoT: Use centralized SharePoint path sanitization
    "emails/attachments/#{SharePoint::FilenameSanitizer.sanitize_path_segment(name)}"
  end
end
