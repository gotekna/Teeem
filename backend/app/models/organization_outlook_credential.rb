class OrganizationOutlookCredential < ApplicationRecord
  # Supports MULTIPLE Microsoft 365 tenants (Tekna, 100xBestLife, Homes of Hope, Love Your World)

  validates :access_token, presence: true
  validates :refresh_token, presence: true
  validates :expires_at, presence: true
  validates :name, uniqueness: true, allow_nil: true

  # Encrypt sensitive tokens at rest
  encrypts :access_token
  encrypts :refresh_token

  # Scopes
  scope :active, -> { all }

  # Multi-org support - returns all credentials
  def self.active_credentials
    order(:name)
  end

  # Legacy singleton pattern - returns first for backward compatibility
  def self.current
    first
  end

  # Find by organization name
  def self.find_by_name(name)
    find_by(name: name)
  end

  # Check if token is expired or about to expire (within 5 minutes)
  def expired?
    return true if expires_at.nil?
    expires_at <= 5.minutes.from_now
  end

  # Refresh the access token using the refresh token
  def refresh!
    return unless refresh_token.present?

    response = HTTP.post("https://login.microsoftonline.com/#{tenant_id_or_common}/oauth2/v2.0/token",
      form: {
        client_id: ENV["OUTLOOK_CLIENT_ID"],
        client_secret: ENV["OUTLOOK_CLIENT_SECRET"],
        refresh_token: refresh_token,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/Mail.Read offline_access"
      }
    )

    if response.status.success?
      data = response.parse
      update!(
        access_token: data["access_token"],
        refresh_token: data["refresh_token"] || refresh_token, # Some responses don't include new refresh token
        expires_at: Time.current + data["expires_in"].to_i.seconds
      )
      Rails.logger.info "Outlook token refreshed successfully"
      true
    else
      Rails.logger.error "Failed to refresh Outlook token: #{response.status} - #{response.body}"
      false
    end
  rescue => e
    Rails.logger.error "Error refreshing Outlook token: #{e.message}"
    false
  end

  # Get a valid access token, refreshing if necessary
  def valid_access_token
    refresh! if expired?
    access_token
  end

  private

  def tenant_id_or_common
    tenant_id.present? ? tenant_id : "common"
  end
end
