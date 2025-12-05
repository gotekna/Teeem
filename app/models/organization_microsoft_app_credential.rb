class OrganizationMicrosoftAppCredential < ApplicationRecord
  # This uses the Client Credentials flow (application permissions)
  # No user interaction needed after admin consent is granted
  # Can access ANY user's mailbox in the tenant

  belongs_to :setup_by, class_name: 'User', optional: true

  # Encrypt sensitive data
  encrypts :client_secret
  encrypts :access_token

  # Validations
  validates :client_id, presence: true
  validates :tenant_id, presence: true
  validates :client_secret, presence: true

  # Scopes
  scope :active, -> { where(is_active: true) }

  # Singleton pattern - only one active credential
  def self.active_credential
    active.first
  end

  def self.connected?
    active_credential&.status == 'connected'
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
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      }
    )

    if response.status.success?
      data = response.parse
      update!(
        access_token: data['access_token'],
        token_expires_at: Time.current + data['expires_in'].to_i.seconds,
        status: 'connected',
        last_error: nil
      )
      Rails.logger.info "[MicrosoftApp] Access token fetched successfully for tenant #{tenant_id}"
      true
    else
      error_msg = "Failed to fetch token: #{response.status} - #{response.body}"
      update!(status: 'error', last_error: error_msg)
      Rails.logger.error "[MicrosoftApp] #{error_msg}"
      false
    end
  rescue StandardError => e
    update!(status: 'error', last_error: e.message)
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
      update!(status: 'connected', last_error: nil)
      true
    else
      error_msg = "API test failed: #{response.status} - #{response.body}"
      update!(status: 'error', last_error: error_msg)
      false
    end
  rescue StandardError => e
    update!(status: 'error', last_error: e.message)
    false
  end

  # Mark as having admin consent
  def mark_admin_consent!(admin_email)
    update!(
      admin_consent_granted_at: Time.current,
      admin_consent_granted_by: admin_email,
      status: 'connected'
    )
  end

  # Deactivate this credential
  def deactivate!
    update!(is_active: false)
  end

  # Get list of users in the tenant (for sync configuration)
  def list_tenant_users
    return [] unless status == 'connected'

    response = HTTP.auth("Bearer #{valid_access_token}")
                   .get("https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName")

    if response.status.success?
      data = response.parse
      data['value'].map do |user|
        {
          id: user['id'],
          name: user['displayName'],
          email: user['mail'] || user['userPrincipalName']
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
end