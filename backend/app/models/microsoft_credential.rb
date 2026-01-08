# frozen_string_literal: true

# MicrosoftCredential - Unified Single Source of Truth for all Microsoft/SharePoint credentials
#
# Replaces legacy credential models (all removed as of Jan 2026):
# - OrganizationMicrosoftAppCredential (app credentials - client credentials flow)
# - OrganizationSharePointCredential (org-level delegated)
# - OrganizationOutlookCredential (org-level delegated)
# - UserMicrosoftToken (user-level delegated)
# - UserOutlookCredential (user-level delegated, removed Dec 2024)
# - OneDriveCredential (per-job delegated, removed Jan 2026 - 0 records in prod)
#
# NAMING POLICY (SSoT):
# - Internal (code): MicrosoftCredential, MicrosoftGraphClient
# - External (UI/messages): Always say "SharePoint" to users, never "OneDrive"
#
class MicrosoftCredential < ApplicationRecord
  # Organization ownership - SSoT for multi-org isolation
  # Required for proper org isolation (backfill complete as of 2025-12-20)
  belongs_to :organization

  # Polymorphic ownership - optional for org-level credentials
  belongs_to :owner, polymorphic: true, optional: true
  belongs_to :setup_by, class_name: "User", optional: true
  belongs_to :connected_by, class_name: "User", optional: true

  # Allowed polymorphic types for owner (security: prevents arbitrary type injection)
  ALLOWED_OWNER_TYPES = %w[User Construction].freeze

  # Encrypt ALL tokens and secrets (SSoT - fixes UserMicrosoftToken security gap)
  encrypts :client_secret
  encrypts :access_token
  encrypts :refresh_token

  # Constants
  CREDENTIAL_TYPES = %w[app delegated].freeze
  STATUSES = %w[pending connected error dead disconnected].freeze

  # Known Microsoft 365 tenant organization names (SSoT)
  # These are the organizations that can have app credentials configured
  KNOWN_ORG_NAMES = ["Tekna", "100xBestLife", "Homes of Hope", "Love Your World"].freeze

  # UNIFIED refresh buffer - 20 minutes (SSoT - same everywhere)
  # Microsoft access tokens typically expire after 60 minutes
  # Buffer MUST be larger than job interval (15 min) to prevent timing gaps
  REFRESH_BUFFER = 20.minutes

  # Required scopes for delegated credentials
  REQUIRED_SCOPES = %w[
    openid
    profile
    email
    offline_access
    Mail.Read
    Files.ReadWrite.All
    Sites.ReadWrite.All
  ].freeze

  # AADSTS error codes indicating refresh token is permanently dead
  # Requires user to re-authenticate via OAuth flow
  DEAD_TOKEN_ERROR_CODES = %w[
    AADSTS65001
    AADSTS70000
    AADSTS70008
    AADSTS54005
    invalid_grant
  ].freeze

  # Validations
  validates :credential_type, presence: true, inclusion: { in: CREDENTIAL_TYPES }
  validates :status, inclusion: { in: STATUSES }
  validates :name, uniqueness: { scope: :is_active, conditions: -> { where(is_active: true) } },
                   allow_nil: true
  validates :client_id, :client_secret, :tenant_id, presence: true, if: :app_credential?
  validates :owner_type, inclusion: { in: ALLOWED_OWNER_TYPES }, allow_nil: true

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :connected, -> { active.where(status: "connected") }
  scope :app_credentials, -> { where(credential_type: "app") }
  scope :delegated_credentials, -> { where(credential_type: "delegated") }
  scope :for_user, ->(user) { where(owner_type: "User", owner_id: user.id) }
  scope :for_construction, ->(construction) { where(owner_type: "Construction", owner_id: construction.id) }
  scope :org_level, -> { where(owner_type: nil) }
  scope :needs_refresh, -> { where("token_expires_at < ?", REFRESH_BUFFER.from_now) }
  scope :alive, -> { where(refresh_token_dead: false) }
  scope :dead, -> { where(refresh_token_dead: true) }
  scope :with_sharepoint, -> { where.not(sharepoint_site_id: nil).where.not(sharepoint_drive_id: nil) }

  # SSoT: Organization-scoped credential lookup - ALWAYS use these instead of .first
  scope :for_org, ->(org) { where(organization: org) }

  # Get active app credential for a specific organization
  def self.active_for_org(organization)
    for_org(organization).active.app_credentials.connected.first
  end

  # Get active delegated credential for a specific organization
  def self.delegated_for_org(organization)
    for_org(organization).active.delegated_credentials.connected.first
  end

  # Type predicates
  def app_credential?
    credential_type == "app"
  end

  def delegated_credential?
    credential_type == "delegated"
  end

  # Token management - unified across both types
  def token_expired?
    return true if token_expires_at.nil?
    token_expires_at <= REFRESH_BUFFER.from_now
  end

  alias_method :needs_refresh?, :token_expired?

  def valid_credential?
    access_token.present? && !token_expired? && status == "connected"
  end

  def connected?
    status == "connected" && access_token.present? && !token_expired?
  end

  # Get a valid access token, refreshing/fetching if needed
  def valid_access_token
    if app_credential?
      fetch_app_token! if token_expired?
    else
      refresh_delegated_token! if token_expired? && !refresh_token_dead?
    end
    access_token
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[MicrosoftCredential] Decryption error: #{e.message}"
    mark_error!("Token decryption failed - reconnection required")
    nil
  end

  # App credential: fetch new token (client credentials flow)
  # Wrapped in transaction to ensure atomic update of all token fields
  def fetch_app_token!
    return false unless app_credential?

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
      # Transaction ensures all token fields are updated atomically
      transaction do
        update!(
          access_token: data["access_token"],
          token_expires_at: Time.current + data["expires_in"].to_i.seconds,
          status: "connected",
          error_code: nil,
          error_message: nil,
          consecutive_failures: 0
        )
      end
      Rails.logger.info "[MicrosoftCredential] App token fetched for #{name || id}"
      true
    else
      error_msg = "Token fetch failed: #{response.status} - #{response.body}"
      record_refresh_failure!(error_msg)
      false
    end
  rescue StandardError => e
    record_refresh_failure!(e.message)
    false
  end

  # Delegated credential: refresh token
  # Wrapped in transaction to ensure atomic update of all token fields
  def refresh_delegated_token!
    return false unless delegated_credential?
    return false if refresh_token.blank?
    return false if refresh_token_dead?

    response = HTTP.post(
      "https://login.microsoftonline.com/#{tenant_id.presence || 'common'}/oauth2/v2.0/token",
      form: {
        client_id: ENV["OUTLOOK_CLIENT_ID"],
        client_secret: ENV["OUTLOOK_CLIENT_SECRET"],
        refresh_token: refresh_token,
        grant_type: "refresh_token",
        scope: scopes.presence || REQUIRED_SCOPES.join(" ")
      }
    )

    if response.status.success?
      data = response.parse
      # Transaction ensures all token fields are updated atomically
      # Prevents partial updates that could leave credential in unusable state
      transaction do
        update!(
          access_token: data["access_token"],
          refresh_token: data["refresh_token"] || refresh_token,
          token_expires_at: Time.current + data["expires_in"].to_i.seconds,
          scopes: data["scope"],
          status: "connected",
          error_code: nil,
          error_message: nil,
          consecutive_failures: 0,
          refresh_token_dead: false,
          last_refresh_attempt_at: Time.current
        )
      end
      Rails.logger.info "[MicrosoftCredential] Token refreshed for #{owner_type}##{owner_id || name}"
      true
    else
      error_data = response.parse rescue {}
      error_msg = error_data["error_description"] || error_data["error"] || "Token refresh failed"
      record_refresh_failure!(error_msg)
      false
    end
  rescue StandardError => e
    record_refresh_failure!(e.message)
    false
  end

  # Alias for backward compatibility with UserMicrosoftToken
  alias_method :refresh_access_token!, :refresh_delegated_token!

  # Dead token detection
  def dead_token_error?(error_message)
    return false if error_message.blank?
    DEAD_TOKEN_ERROR_CODES.any? { |code| error_message.to_s.include?(code) }
  end

  # Error tracking
  def mark_error!(message)
    update!(
      status: "error",
      error_message: message,
      last_error_at: Time.current
    )
  end

  def mark_dead!(error_message = nil)
    update!(
      refresh_token_dead: true,
      status: "dead",
      error_code: extract_error_code(error_message),
      error_message: error_message,
      last_error_at: Time.current,
      last_refresh_attempt_at: Time.current
    )
    Rails.logger.warn "[MicrosoftCredential] Marked as dead: #{owner_type}##{owner_id || name} - #{error_message}"
  end

  def record_refresh_failure!(error_message)
    new_count = (consecutive_failures || 0) + 1

    if dead_token_error?(error_message)
      mark_dead!(error_message)
    else
      update!(
        consecutive_failures: new_count,
        error_message: error_message,
        last_error_at: Time.current,
        last_refresh_attempt_at: Time.current,
        status: "error"
      )
    end
  end

  def record_refresh_success!
    update!(
      consecutive_failures: 0,
      refresh_token_dead: false,
      error_code: nil,
      error_message: nil,
      last_refresh_attempt_at: Time.current,
      status: "connected"
    )
  end

  # Reconnection helpers (for frontend display)
  def reconnect_reason
    return nil unless refresh_token_dead? || status.in?(%w[error dead])

    case
    when error_message&.include?("AADSTS65001") then "consent_revoked"
    when error_message&.include?("AADSTS70008") then "token_expired"
    when error_message&.include?("AADSTS70000") then "grant_revoked"
    when refresh_token_dead? then "refresh_token_dead"
    else "unknown_error"
    end
  end

  # Mark as connected after successful OAuth
  def mark_connected!(tokens)
    update!(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: Time.current + tokens[:expires_in].to_i.seconds,
      scopes: tokens[:scope],
      email: tokens[:email],
      status: "connected",
      error_code: nil,
      error_message: nil,
      refresh_token_dead: false,
      consecutive_failures: 0,
      connected_by_id: tokens[:connected_by_id]
    )
  end

  # Mark as having admin consent (for app credentials)
  def mark_admin_consent!(admin_email)
    update!(
      admin_consent_granted_at: Time.current,
      admin_consent_granted_by: admin_email,
      status: "connected"
    )
  end

  # Disconnect
  def disconnect!
    update!(
      access_token: nil,
      refresh_token: nil,
      token_expires_at: nil,
      status: "disconnected",
      is_active: false,
      error_code: nil,
      error_message: nil
    )
  end

  # Deactivate (soft delete)
  def deactivate!
    update!(is_active: false)
  end

  # Find by name (for multi-org support)
  def self.find_by_name(name)
    active.find_by(name: name)
  end

  # Backward compatibility with OrganizationMicrosoftAppCredential
  # WARNING: Prefer active_for_org(org) for proper org isolation
  def self.active_credential
    app_credentials.active.connected.first
  end

  # Get all active app credentials (for admin lists)
  def self.active_credentials
    app_credentials.active.order(:name)
  end

  # SSoT: SharePoint credential lookup (replaces OrganizationSharePointCredential.active_credential)
  # Tries delegated credentials first (user OAuth), then app credentials (client credentials)
  def self.sharepoint_credential
    delegated_credentials.org_level.active.connected.first ||
      app_credentials.connected.first
  end

  # SharePoint configuration helpers (SSoT - previously split across models)
  def self.teeem_sharepoint_config
    configured = active.with_sharepoint.first
    return nil unless configured

    {
      site_id: configured.sharepoint_site_id,
      drive_id: configured.sharepoint_drive_id,
      drive_name: configured.sharepoint_drive_name,
      credential: configured
    }
  end

  def self.sharepoint_configured?
    teeem_sharepoint_config.present?
  end

  def sharepoint_configured?
    sharepoint_site_id.present? && sharepoint_drive_id.present?
  end

  # Test the connection by making a simple API call
  # IMPORTANT: App credentials (client_credentials) cannot call /me - no user context
  # Use different endpoints based on credential type
  def test_connection!
    if app_credential?
      return false unless fetch_app_token!
      # App credentials: test with /organization endpoint (works without user context)
      test_url = "https://graph.microsoft.com/v1.0/organization"
    else
      return false unless valid_access_token
      # Delegated credentials: test with /me endpoint (requires user context)
      test_url = "https://graph.microsoft.com/v1.0/me"
    end

    response = HTTP.auth("Bearer #{access_token}").get(test_url)

    if response.status.success?
      update!(status: "connected", error_message: nil)
      true
    else
      error_body = response.body.to_s rescue ""
      mark_error!("API test failed: #{response.status} - #{error_body.truncate(200)}")
      false
    end
  rescue StandardError => e
    mark_error!(e.message)
    false
  end

  # Get list of users in the tenant (for sync configuration and mailbox access)
  # Returns array of { id:, name:, email: } hashes
  def list_tenant_users
    return [] unless status == "connected"

    token = valid_access_token
    return [] if token.blank?

    response = HTTP.auth("Bearer #{token}")
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
      Rails.logger.error "[MicrosoftCredential] Failed to list users for #{name}: #{response.body}"
      []
    end
  rescue StandardError => e
    Rails.logger.error "[MicrosoftCredential] Error listing users for #{name}: #{e.message}"
    []
  end

  private

  def extract_error_code(error_message)
    return nil if error_message.blank?
    DEAD_TOKEN_ERROR_CODES.find { |code| error_message.include?(code) }
  end
end
