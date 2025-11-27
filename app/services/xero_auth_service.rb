require 'oauth2'

class XeroAuthService
  AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
  TOKEN_URL = 'https://identity.xero.com/connect/token'
  CONNECTIONS_URL = 'https://api.xero.com/connections'

  class AuthenticationError < StandardError; end
  class ApiError < StandardError; end

  def initialize(company = nil)
    @company = company
    @client_id = ENV['XERO_CLIENT_ID']
    @client_secret = ENV['XERO_CLIENT_SECRET']
    @redirect_uri = ENV['XERO_REDIRECT_URI'] || "#{ENV['FRONTEND_URL']}/corporate/xero/callback"

    raise AuthenticationError, 'Missing Xero credentials in environment' unless credentials_present?
  end

  # Generate OAuth authorization URL for a specific company
  def authorization_url(state = nil)
    client = oauth_client
    client.auth_code.authorize_url(
      redirect_uri: @redirect_uri,
      scope: 'offline_access accounting.transactions accounting.contacts accounting.settings accounting.reports.read',
      state: state # Pass company_id as state to retrieve after callback
    )
  end

  # Exchange authorization code for access token
  def exchange_code_for_token(code, company_id)
    company = Company.find(company_id)

    begin
      client = oauth_client
      token = client.auth_code.get_token(code, redirect_uri: @redirect_uri)

      # Get tenant information
      tenant_info = get_tenant_info(token.token)

      if tenant_info.empty?
        raise ApiError, 'No Xero organization connected'
      end

      # Use the first organization (or let user select if multiple)
      tenant = tenant_info.first

      # Create or update Xero connection for this company
      connection = company.company_xero_connection || company.build_company_xero_connection

      connection.assign_attributes(
        xero_tenant_id: tenant['tenantId'],
        xero_tenant_name: tenant['tenantName'],
        xero_tenant_type: tenant['tenantType'],
        access_token: token.token,
        refresh_token: token.refresh_token,
        token_expires_at: Time.current + token.expires_in.seconds,
        connection_status: 'connected'
      )

      connection.save!

      Rails.logger.info("Xero OAuth successful for #{company.name}: #{tenant['tenantName']} (#{tenant['tenantId']})")

      {
        success: true,
        company_id: company.id,
        tenant_name: tenant['tenantName'],
        tenant_id: tenant['tenantId'],
        expires_at: connection.token_expires_at
      }
    rescue OAuth2::Error => e
      Rails.logger.error("Xero OAuth error: #{e.message}")
      raise AuthenticationError, "Failed to exchange code: #{e.message}"
    rescue StandardError => e
      Rails.logger.error("Xero token exchange error: #{e.message}")
      raise ApiError, "Token exchange failed: #{e.message}"
    end
  end

  # Refresh the access token for a company
  def refresh_access_token(connection)
    begin
      # Try to access encrypted fields
      access_token = connection.access_token
      refresh_token = connection.refresh_token
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Xero credential decryption failed - marking as disconnected: #{e.message}")
      connection.mark_error!('Credentials corrupted. Please reconnect.')
      raise AuthenticationError, 'Xero credentials are corrupted. Please reconnect to Xero.'
    end

    begin
      client = oauth_client
      old_token = OAuth2::AccessToken.new(
        client,
        access_token,
        refresh_token: refresh_token
      )

      new_token = old_token.refresh!

      connection.update!(
        access_token: new_token.token,
        refresh_token: new_token.refresh_token,
        token_expires_at: Time.current + new_token.expires_in.seconds,
        connection_status: 'connected',
        last_sync_error: nil
      )

      Rails.logger.info("Xero token refreshed for #{connection.company.name}")

      { success: true, expires_at: connection.token_expires_at }
    rescue OAuth2::Error => e
      Rails.logger.error("Xero token refresh error: #{e.message}")
      connection.mark_error!("Token refresh failed: #{e.message}")
      raise AuthenticationError, "Failed to refresh token: #{e.message}"
    end
  end

  # Disconnect Xero for a company
  def disconnect(connection)
    connection.mark_disconnected!
    Rails.logger.info("Xero disconnected for #{connection.company.name}")
    { success: true }
  end

  # Get valid access token (refresh if needed)
  def get_valid_token(connection)
    if connection.token_expired?
      refresh_access_token(connection)
      connection.reload
    end
    connection.access_token
  end

  private

  def oauth_client
    OAuth2::Client.new(
      @client_id,
      @client_secret,
      site: 'https://api.xero.com',
      authorize_url: AUTH_URL,
      token_url: TOKEN_URL
    )
  end

  def get_tenant_info(access_token)
    response = HTTParty.get(
      CONNECTIONS_URL,
      headers: {
        'Authorization' => "Bearer #{access_token}",
        'Content-Type' => 'application/json'
      }
    )

    if response.success?
      JSON.parse(response.body)
    else
      Rails.logger.error("Failed to get tenant info: #{response.code} - #{response.body}")
      []
    end
  rescue StandardError => e
    Rails.logger.error("Error getting tenant info: #{e.message}")
    []
  end

  def credentials_present?
    @client_id.present? && @client_secret.present? && @redirect_uri.present?
  end
end
