require 'oauth2'
require 'httparty'
require 'base64'

class XeroApiClient
  include HTTParty

  BASE_URL = 'https://api.xero.com/api.xro/2.0'
  AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
  TOKEN_URL = 'https://identity.xero.com/connect/token'
  CONNECTIONS_URL = 'https://api.xero.com/connections'

  # Custom error classes
  class ApiError < StandardError; end
  class AuthenticationError < StandardError; end
  class RateLimitError < StandardError; end

  def initialize
    @client_id = ENV['XERO_CLIENT_ID']
    @client_secret = ENV['XERO_CLIENT_SECRET']
    @redirect_uri = ENV['XERO_REDIRECT_URI']

    raise AuthenticationError, 'Missing Xero credentials in environment' unless credentials_present?
  end

  # Generate OAuth authorization URL
  def authorization_url
    client = oauth_client
    client.auth_code.authorize_url(
      redirect_uri: @redirect_uri,
      scope: 'offline_access accounting.transactions accounting.contacts accounting.settings'
    )
  end

  # Exchange authorization code for access token
  def exchange_code_for_token(code)
    begin
      client = oauth_client
      token = client.auth_code.get_token(code, redirect_uri: @redirect_uri)

      # Get tenant information
      tenant_info = get_tenant_info(token.token)

      if tenant_info.empty?
        raise ApiError, 'No Xero organization connected'
      end

      # Use the first organization
      tenant = tenant_info.first

      # Store credentials in database
      credential = XeroCredential.create!(
        access_token: token.token,
        refresh_token: token.refresh_token,
        expires_at: Time.current + token.expires_in.seconds,
        tenant_id: tenant['tenantId'],
        tenant_name: tenant['tenantName'],
        tenant_type: tenant['tenantType']
      )

      Rails.logger.info("Xero OAuth successful: #{tenant['tenantName']} (#{tenant['tenantId']})")

      {
        success: true,
        tenant_name: tenant['tenantName'],
        tenant_id: tenant['tenantId'],
        expires_at: credential.expires_at
      }
    rescue OAuth2::Error => e
      Rails.logger.error("Xero OAuth error: #{e.message}")
      raise AuthenticationError, "Failed to exchange code: #{e.message}"
    rescue StandardError => e
      Rails.logger.error("Xero token exchange error: #{e.message}")
      raise ApiError, "Token exchange failed: #{e.message}"
    end
  end

  # Refresh the access token
  def refresh_access_token
    credential = XeroCredential.current
    return { success: false, error: 'No credentials found' } unless credential

    refresh_access_token_for(credential)
  end

  # Refresh the access token for a specific credential (multi-tenant support)
  def refresh_access_token_for(credential)
    return { success: false, error: 'No credentials provided' } unless credential

    begin
      # Try to access encrypted fields to check if decryption works
      access_token = credential.access_token
      refresh_token_value = credential.refresh_token
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Xero credential decryption failed in refresh_access_token - deleting corrupted credentials: #{e.message}")
      # Delete the corrupted credential
      credential.destroy
      raise AuthenticationError, 'Xero credentials are corrupted. Please reconnect to Xero.'
    end

    begin
      client = oauth_client
      old_token = OAuth2::AccessToken.new(
        client,
        access_token,
        refresh_token: refresh_token_value
      )

      new_token = old_token.refresh!

      # Update stored credential
      credential.update!(
        access_token: new_token.token,
        refresh_token: new_token.refresh_token,
        expires_at: Time.current + new_token.expires_in.seconds
      )

      Rails.logger.info("Xero token refreshed successfully for tenant #{credential.tenant_name}")

      {
        success: true,
        expires_at: credential.expires_at
      }
    rescue OAuth2::Error => e
      Rails.logger.error("Xero token refresh error: #{e.message}")
      raise AuthenticationError, "Failed to refresh token: #{e.message}"
    end
  end

  # Make authenticated GET request to Xero API
  # Options can include :tenant_id to specify which tenant to use
  def get(endpoint, params = {})
    # Extract tenant_id from params if provided
    options = {}
    if params.is_a?(Hash) && params[:tenant_id].present?
      options[:tenant_id] = params.delete(:tenant_id)
    end
    make_request(:get, endpoint, params, options)
  end

  # Make authenticated POST request to Xero API
  # Options can include :tenant_id to specify which tenant to use
  def post(endpoint, data = {}, options = {})
    make_request(:post, endpoint, data, options)
  end

  # Make authenticated PUT request to Xero API
  def put(endpoint, data = {})
    make_request(:put, endpoint, data)
  end

  # Check connection status
  # Will attempt to refresh expired tokens automatically
  def connection_status
    credential = XeroCredential.current

    if credential.nil?
      return {
        connected: false,
        message: 'Not connected to Xero'
      }
    end

    # Try to access encrypted fields to check if decryption works
    begin
      # This will raise ActiveRecord::Encryption::Errors::Decryption if keys are wrong
      _test_access = credential.access_token
      _test_refresh = credential.refresh_token
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Xero credential decryption failed in connection_status - deleting corrupted credentials: #{e.message}")
      # Delete the corrupted credential
      credential.destroy
      return {
        connected: false,
        message: 'Xero credentials are corrupted. Please reconnect to Xero.'
      }
    end

    # If token is expired but we have a refresh token, try to refresh
    if credential.expired? && credential.refresh_token.present?
      begin
        Rails.logger.info "[Xero Status] Token expired, attempting refresh..."
        refresh_access_token_for(credential)
        credential.reload
        Rails.logger.info "[Xero Status] Token refreshed successfully"
      rescue StandardError => e
        Rails.logger.error "[Xero Status] Token refresh failed: #{e.message}"
        return {
          connected: false,
          message: 'Session expired. Please reconnect to Xero.',
          error: 'Token refresh failed'
        }
      end
    end

    {
      connected: true,
      tenant_name: credential.tenant_name,
      tenant_id: credential.tenant_id,
      expires_at: credential.expires_at,
      expired: credential.expired?
    }
  end

  # Disconnect from Xero (revoke tokens)
  def disconnect
    credential = XeroCredential.current
    return { success: false, error: 'Not connected' } unless credential

    begin
      # Revoke the refresh token with Xero
      # This will invalidate all tokens and disconnect the app
      revoke_token(credential.refresh_token)

      # Delete our stored credentials
      credential.destroy

      Rails.logger.info("Xero disconnected successfully - tokens revoked and credentials deleted")

      { success: true, message: 'Disconnected from Xero' }
    rescue StandardError => e
      Rails.logger.error("Xero disconnect error: #{e.message}")

      # Even if revocation fails, delete the local credentials
      begin
        credential.destroy
        Rails.logger.warn("Xero token revocation failed but local credentials deleted")
      rescue => deletion_error
        Rails.logger.error("Failed to delete credentials: #{deletion_error.message}")
      end

      { success: false, error: e.message }
    end
  end

  # Revoke a Xero OAuth2 token
  def revoke_token(token)
    return if token.blank?

    begin
      auth_header = Base64.strict_encode64("#{@client_id}:#{@client_secret}")

      response = HTTParty.post(
        'https://identity.xero.com/connect/revocation',
        headers: {
          'Authorization' => "Basic #{auth_header}",
          'Content-Type' => 'application/x-www-form-urlencoded'
        },
        body: "token=#{token}",
        timeout: 10
      )

      if response.code == 200
        Rails.logger.info("Xero token revoked successfully")
      else
        Rails.logger.warn("Xero token revocation returned #{response.code}: #{response.body}")
      end
    rescue StandardError => e
      Rails.logger.error("Failed to revoke Xero token: #{e.message}")
      raise
    end
  end

  # Fetch tax rates from Xero
  def get_tax_rates
    response = make_request(:get, 'TaxRates')

    if response[:success]
      tax_rates = response[:data]['TaxRates'] || []

      # Update local database
      tax_rates.each do |rate|
        XeroTaxRate.find_or_initialize_by(code: rate['TaxType']).tap do |tax_rate|
          tax_rate.name = rate['Name']
          tax_rate.rate = rate['EffectiveRate']
          tax_rate.active = rate['Status'] == 'ACTIVE'
          tax_rate.display_rate = rate['DisplayTaxRate']
          tax_rate.tax_type = rate['TaxType']
          tax_rate.save!
        end
      end

      { success: true, tax_rates: XeroTaxRate.where(active: true).order(:name) }
    else
      { success: false, error: 'Failed to fetch tax rates from Xero' }
    end
  rescue StandardError => e
    Rails.logger.error("Error fetching Xero tax rates: #{e.message}")
    { success: false, error: e.message }
  end

  # Fetch chart of accounts from Xero
  def get_accounts
    response = make_request(:get, 'Accounts')

    if response[:success]
      accounts = response[:data]['Accounts'] || []

      # Update local database
      accounts.each do |account|
        # Skip accounts without a code or name
        next if account['Code'].blank? || account['Name'].blank?

        XeroAccount.find_or_initialize_by(code: account['Code']).tap do |xero_account|
          xero_account.name = account['Name']
          xero_account.account_type = account['Type']
          xero_account.tax_type = account['TaxType']
          xero_account.description = account['Description']
          xero_account.active = account['Status'] == 'ACTIVE'
          xero_account.account_class = account['Class']
          xero_account.system_account = account['SystemAccount'] || false
          xero_account.enable_payments_to_account = account['EnablePaymentsToAccount'] || false
          xero_account.show_in_expense_claims = account['ShowInExpenseClaims'] || false
          xero_account.save!
        end
      end

      { success: true, accounts: XeroAccount.active.order(:code) }
    else
      { success: false, error: 'Failed to fetch accounts from Xero' }
    end
  rescue StandardError => e
    Rails.logger.error("Error fetching Xero accounts: #{e.message}")
    { success: false, error: e.message }
  end

  private

  def credentials_present?
    @client_id.present? && @client_secret.present? && @redirect_uri.present?
  end

  def oauth_client
    OAuth2::Client.new(
      @client_id,
      @client_secret,
      site: 'https://login.xero.com',
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
      raise ApiError, "Failed to get tenant info: #{response.code}"
    end
  end

  def make_request(method, endpoint, data = {}, options = {})
    # Support specifying a specific tenant_id
    tenant_id = options[:tenant_id]

    credential = if tenant_id.present?
      XeroCredential.find_by(tenant_id: tenant_id) || XeroCredential.current
    else
      XeroCredential.current
    end

    unless credential
      raise AuthenticationError, 'Not authenticated with Xero'
    end

    # Try to access encrypted fields to check if decryption works
    begin
      # This will raise ActiveRecord::Encryption::Errors::Decryption if keys are wrong
      _test_access = credential.access_token
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Xero credential decryption failed - deleting corrupted credentials: #{e.message}")
      # Delete the corrupted credential
      credential.destroy
      raise AuthenticationError, 'Xero credentials are corrupted. Please reconnect to Xero.'
    end

    # Refresh token if expired
    refresh_access_token_for(credential) if credential.expired?

    # Reload credential to get updated token
    credential.reload

    url = "#{BASE_URL}/#{endpoint}"

    begin
      headers = {
        'Authorization' => "Bearer #{credential.access_token}",
        'Xero-tenant-id' => credential.tenant_id,
        'Content-Type' => 'application/json',
        'Accept' => 'application/json'
      }

      response = case method
      when :get
        HTTParty.get(url, headers: headers, query: data, timeout: 30)
      when :post
        HTTParty.post(url, headers: headers, body: data.to_json, timeout: 30)
      when :put
        HTTParty.put(url, headers: headers, body: data.to_json, timeout: 30)
      else
        raise ArgumentError, "Unsupported HTTP method: #{method}"
      end

      handle_response(response)
    rescue Net::ReadTimeout => e
      Rails.logger.error("Xero API timeout: #{e.message}")
      raise ApiError, 'Request timeout'
    rescue StandardError => e
      Rails.logger.error("Xero API error: #{e.message}")
      raise ApiError, e.message
    end
  end

  def handle_response(response)
    case response.code
    when 200..299
      # Success
      Rails.logger.info("Xero API request successful: #{response.code}")
      {
        success: true,
        data: JSON.parse(response.body)
      }
    when 401
      # Unauthorized - token may be invalid
      Rails.logger.error("Xero API unauthorized (401): #{response.body}")
      error_body = JSON.parse(response.body) rescue {}
      error_detail = error_body['Detail'] || error_body['message'] || 'Authentication failed'
      raise AuthenticationError, "Authentication failed: #{error_detail}"
    when 404
      # Not Found - endpoint or resource doesn't exist
      Rails.logger.error("Xero API not found (404): #{response.body}")
      error_body = JSON.parse(response.body) rescue {}
      error_detail = error_body['Detail'] || error_body['message'] || 'Resource not found'
      raise ApiError, "Not found: #{error_detail}"
    when 429
      # Rate limit exceeded
      retry_after = response.headers['Retry-After'] || 60
      Rails.logger.warn("Xero API rate limit hit. Retry after: #{retry_after}s")
      raise RateLimitError, "Rate limit exceeded. Retry after #{retry_after} seconds"
    when 400..499
      # Client error
      error_body = JSON.parse(response.body) rescue {}
      error_message = error_body['Message'] || error_body['message'] || error_body['Detail'] || 'Client error'
      error_details = error_body['Elements'] || []

      full_error = "#{error_message}"
      if error_details.any?
        detail_messages = error_details.map { |e| e['ValidationErrors']&.map { |v| v['Message'] } }.flatten.compact
        full_error += ": #{detail_messages.join(', ')}" if detail_messages.any?
      end

      Rails.logger.error("Xero API client error (#{response.code}): #{full_error}")
      Rails.logger.error("Response body: #{response.body}")
      raise ApiError, full_error
    when 500..599
      # Server error
      Rails.logger.error("Xero API server error (#{response.code}): #{response.body}")
      raise ApiError, "Xero server error (#{response.code})"
    else
      Rails.logger.error("Xero API unexpected response (#{response.code}): #{response.body}")
      raise ApiError, "Unexpected response code: #{response.code}"
    end
  end
end
