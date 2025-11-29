class UserMicrosoftToken < ApplicationRecord
  belongs_to :user

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

  scope :connected, -> { where(status: 'connected') }
  scope :needs_refresh, -> { where('token_expires_at < ?', 5.minutes.from_now) }
  scope :with_errors, -> { where(status: 'error') }

  # Check if token needs refresh
  def needs_refresh?
    token_expires_at.nil? || token_expires_at < 5.minutes.from_now
  end

  # Check if token is valid and connected
  def connected?
    status == 'connected' && access_token.present? && !needs_refresh?
  end

  # Mark as error with message
  def mark_error!(message)
    update!(status: 'error', sync_error: message)
  end

  # Mark as connected after successful OAuth
  def mark_connected!(tokens)
    update!(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: Time.current + tokens[:expires_in].to_i.seconds,
      scopes: tokens[:scope],
      status: 'connected',
      sync_error: nil
    )
  end

  # Disconnect the token
  def disconnect!
    update!(
      access_token: nil,
      refresh_token: nil,
      token_expires_at: nil,
      status: 'disconnected',
      sync_error: nil
    )
  end

  # Refresh the access token using refresh_token
  def refresh_access_token!
    return false unless refresh_token.present?

    response = HTTParty.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      body: {
        client_id: ENV['OUTLOOK_CLIENT_ID'],
        client_secret: ENV['OUTLOOK_CLIENT_SECRET'],
        refresh_token: refresh_token,
        grant_type: 'refresh_token',
        scope: REQUIRED_SCOPES.join(' ')
      }
    )

    if response.success?
      data = response.parsed_response
      mark_connected!(
        access_token: data['access_token'],
        refresh_token: data['refresh_token'] || refresh_token,
        expires_in: data['expires_in'],
        scope: data['scope']
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
end
