# DEPRECATED: This model is being replaced by MicrosoftCredential (SSoT migration)
# Use MicrosoftCredential.for_user(user) instead
# Migration: MigrateMicrosoftCredentialsJob
# Removal planned: After MicrosoftCredential is fully adopted
class UserMicrosoftToken < ApplicationRecord
  belongs_to :user

  # Log deprecation warning (once per class load)
  def self.inherited(subclass)
    warn_deprecation
    super
  end

  def self.warn_deprecation
    return if @deprecation_warned
    @deprecation_warned = true
    Rails.logger.warn "[DEPRECATED] UserMicrosoftToken is deprecated. Use MicrosoftCredential instead."
  end

  # Status values
  STATUSES = %w[pending connected error disconnected].freeze

  # Microsoft Graph scopes for full access
  REQUIRED_SCOPES = %w[
    openid
    profile
    email
    offline_access
    Mail.Read
    Files.Read.All
    Sites.Read.All
  ].freeze

  validates :user_id, uniqueness: true
  validates :status, inclusion: { in: STATUSES }

  # Refresh tokens 20 minutes BEFORE they expire (proactive, not reactive)
  # Microsoft access tokens typically expire after 60 minutes
  # Buffer MUST be larger than job interval (15 min) to prevent timing gaps
  # Example: Token expires 07:30, job at 07:15 checks 07:30 < 07:35 = true ✓
  REFRESH_BUFFER = 20.minutes

  scope :connected, -> { where(status: "connected") }
  scope :needs_refresh, -> { where("token_expires_at < ?", REFRESH_BUFFER.from_now) }
  scope :with_errors, -> { where(status: "error") }
  scope :alive, -> { where(refresh_token_dead: false) }
  scope :dead, -> { where(refresh_token_dead: true) }

  # AADSTS error codes that indicate the refresh token is permanently dead
  # and requires user to re-authenticate via OAuth flow
  DEAD_TOKEN_ERROR_CODES = [
    "AADSTS65001",  # User has not consented / consent revoked
    "AADSTS70000",  # Grant has been revoked
    "AADSTS70008",  # Refresh token expired (90+ days)
    "AADSTS54005",  # OAuth2 authorization code invalid
    "invalid_grant" # Generic dead token error
  ].freeze

  # Check if token needs refresh (20 min buffer for proactive refresh)
  def needs_refresh?
    token_expires_at.nil? || token_expires_at < REFRESH_BUFFER.from_now
  end

  # Alias for compatibility with MicrosoftGraphClient which expects token_expired?
  alias_method :token_expired?, :needs_refresh?

  # Check if token is valid and connected
  def connected?
    status == "connected" && access_token.present? && !needs_refresh?
  end

  # Mark as error with message
  def mark_error!(message)
    update!(status: "error", sync_error: message)
  end

  # Mark refresh token as dead (requires full re-auth via OAuth)
  def mark_refresh_token_dead!(error_message = nil)
    update!(
      refresh_token_dead: true,
      status: "error",
      sync_error: error_message || "Refresh token expired - please reconnect",
      last_refresh_attempt_at: Time.current
    )
  end

  # Record a failed refresh attempt
  def record_refresh_failure!(error_message)
    new_count = (consecutive_failures || 0) + 1

    # Check if this is a permanent failure (dead token)
    if dead_token_error?(error_message)
      mark_refresh_token_dead!(error_message)
    else
      update!(
        consecutive_failures: new_count,
        sync_error: error_message,
        last_refresh_attempt_at: Time.current
      )
    end
  end

  # Record a successful refresh
  def record_refresh_success!
    update!(
      consecutive_failures: 0,
      refresh_token_dead: false,
      last_refresh_attempt_at: Time.current
    )
  end

  # Check if an error message indicates the refresh token is permanently dead
  def dead_token_error?(error_message)
    return false if error_message.blank?
    DEAD_TOKEN_ERROR_CODES.any? { |code| error_message.include?(code) }
  end

  # Get the reason for reconnection (for frontend display)
  def reconnect_reason
    return nil unless refresh_token_dead? || status == "error"

    if sync_error&.include?("AADSTS65001")
      "consent_revoked"
    elsif sync_error&.include?("AADSTS70008")
      "token_expired"
    elsif sync_error&.include?("AADSTS70000")
      "grant_revoked"
    elsif refresh_token_dead?
      "refresh_token_dead"
    else
      "unknown_error"
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
      sync_error: nil,
      refresh_token_dead: false,
      consecutive_failures: 0
    )
  end

  # Disconnect the token
  def disconnect!
    update!(
      access_token: nil,
      refresh_token: nil,
      token_expires_at: nil,
      status: "disconnected",
      sync_error: nil
    )
  end

  # Refresh the access token using refresh_token
  def refresh_access_token!
    return false unless refresh_token.present?

    response = HTTParty.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      body: {
        client_id: ENV["OUTLOOK_CLIENT_ID"],
        client_secret: ENV["OUTLOOK_CLIENT_SECRET"],
        refresh_token: refresh_token,
        grant_type: "refresh_token",
        scope: REQUIRED_SCOPES.join(" ")
      }
    )

    if response.success?
      data = response.parsed_response
      mark_connected!(
        access_token: data["access_token"],
        refresh_token: data["refresh_token"] || refresh_token,
        expires_in: data["expires_in"],
        scope: data["scope"]
      )
      true
    else
      mark_error!("Token refresh failed: #{response.parsed_response['error_description']}")
      false
    end
  rescue StandardError => e
    mark_error!("Token refresh error: #{e.message}")
    false
  end

  # Get a valid access token, refreshing if needed
  def valid_access_token
    if needs_refresh?
      return nil unless refresh_access_token!
    end
    access_token
  end

  # Compatibility with OrganizationSharePointCredential interface
  # These are used by MicrosoftGraphClient when user tokens are used as a fallback

  def root_folder_id
    nil # User tokens don't have organization-configured root folders
  end

  def drive_id
    nil # Will use /me/drive by default
  end

  def valid_credential?
    connected?
  end

  def metadata
    {} # User tokens don't store metadata hash
  end
end
