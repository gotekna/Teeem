require "httparty"
require "base64"

# BasiqClient - Open Banking integration for Australian bank feeds
#
# Basiq API Documentation: https://api.basiq.io/docs
# Base URL: https://au-api.basiq.io
#
# Flow:
#   1. Get access token (exchange API key)
#   2. Create user (one per organization)
#   3. Create consent → returns consent UI URL
#   4. User completes consent in Basiq UI → selects bank → authenticates
#   5. Webhook notifies of connection success
#   6. Fetch accounts and transactions
#
class BasiqClient
  include HTTParty

  BASE_URL = "https://au-api.basiq.io"

  # Custom error classes
  class ApiError < StandardError; end
  class AuthenticationError < StandardError; end
  class RateLimitError < StandardError; end

  def initialize
    @api_key = ENV["BASIQ_API_KEY"]
    raise AuthenticationError, "Missing BASIQ_API_KEY in environment" unless @api_key.present?
  end

  # ============================================
  # AUTHENTICATION
  # ============================================

  # Get access token by exchanging API key
  # Access tokens are valid for 60 minutes
  # @return [Hash] { success: true, access_token: '...', expires_in: 3600 }
  def get_access_token
    response = HTTParty.post(
      "#{BASE_URL}/token",
      headers: {
        "Authorization" => "Basic #{@api_key}",
        "Content-Type" => "application/x-www-form-urlencoded",
        "basiq-version" => "3.0"
      },
      body: "scope=SERVER_ACCESS",
      timeout: 30
    )

    if response.success?
      data = JSON.parse(response.body)
      @access_token = data["access_token"]
      @token_expires_at = Time.current + data["expires_in"].to_i.seconds

      Rails.logger.info("[Basiq] Access token obtained, expires in #{data['expires_in']}s")

      {
        success: true,
        access_token: @access_token,
        expires_in: data["expires_in"]
      }
    else
      error_message = parse_error(response)
      Rails.logger.error("[Basiq] Failed to get access token: #{error_message}")
      { success: false, error: error_message }
    end
  rescue StandardError => e
    Rails.logger.error("[Basiq] Token request failed: #{e.message}")
    { success: false, error: e.message }
  end

  # Ensure we have a valid access token
  def ensure_token!
    if @access_token.blank? || (@token_expires_at && Time.current >= @token_expires_at - 5.minutes)
      result = get_access_token
      raise AuthenticationError, result[:error] unless result[:success]
    end
    @access_token
  end

  # ============================================
  # USER MANAGEMENT
  # ============================================

  # Create a Basiq user
  # @param email [String] - User's email (required)
  # @param mobile [String] - User's mobile in E.164 format, e.g., "+61400000000" (optional)
  # @return [Hash] { success: true, user_id: '...', ... }
  def create_user(email:, mobile: nil, first_name: nil, last_name: nil)
    ensure_token!

    body = { email: email }
    body[:mobile] = mobile if mobile.present?
    body[:firstName] = first_name if first_name.present?
    body[:lastName] = last_name if last_name.present?

    response = make_request(:post, "/users", body)

    if response[:success]
      user = response[:data]
      Rails.logger.info("[Basiq] User created: #{user['id']}")
      {
        success: true,
        user_id: user["id"],
        email: user["email"],
        mobile: user["mobile"]
      }
    else
      { success: false, error: response[:error] }
    end
  end

  # Get a Basiq user
  # @param user_id [String] - The Basiq user ID
  # @return [Hash] { success: true, user: {...} }
  def get_user(user_id)
    ensure_token!
    make_request(:get, "/users/#{user_id}")
  end

  # Delete a Basiq user
  # @param user_id [String] - The Basiq user ID
  def delete_user(user_id)
    ensure_token!

    response = HTTParty.delete(
      "#{BASE_URL}/users/#{user_id}",
      headers: auth_headers,
      timeout: 30
    )

    if response.code == 204 || response.success?
      Rails.logger.info("[Basiq] User deleted: #{user_id}")
      { success: true }
    else
      { success: false, error: parse_error(response) }
    end
  end

  # ============================================
  # CONSENT MANAGEMENT
  # ============================================

  # Create a consent request to initiate bank connection
  # Returns a URL that the user should be redirected to
  #
  # @param user_id [String] - The Basiq user ID
  # @param options [Hash] - Optional parameters
  #   - :duration [String] - Consent duration, e.g., "ongoing" or "once" (default: "ongoing")
  #   - :permissions [Array] - Data permissions (default: all standard permissions)
  #   - :redirect_url [String] - URL to redirect after consent completion
  #
  # @return [Hash] { success: true, consent_url: '...', consent_id: '...' }
  def create_consent(user_id, options = {})
    ensure_token!

    # Default permissions for transaction data
    permissions = options[:permissions] || [
      "account_details",
      "account_balance",
      "account_numbers",
      "transaction_details"
    ]

    body = {
      duration: options[:duration] || "ongoing",
      permissions: permissions
    }

    # Add redirect URL if provided (for post-consent redirect)
    if options[:redirect_url].present?
      body[:partnerCustomerId] = user_id  # For tracking
    end

    response = make_request(:post, "/users/#{user_id}/consents", body)

    if response[:success]
      consent = response[:data]
      links = consent["links"] || {}

      # The consent UI URL is in links.self or we construct it
      consent_url = links["public"] || "https://consent.basiq.io/home?token=#{consent['id']}"

      Rails.logger.info("[Basiq] Consent created: #{consent['id']} for user #{user_id}")

      {
        success: true,
        consent_id: consent["id"],
        consent_url: consent_url,
        status: consent["status"]
      }
    else
      { success: false, error: response[:error] }
    end
  end

  # Get consent status
  # @param user_id [String] - The Basiq user ID
  # @param consent_id [String] - The consent ID
  def get_consent(user_id, consent_id)
    ensure_token!
    make_request(:get, "/users/#{user_id}/consents/#{consent_id}")
  end

  # Delete/revoke a consent
  def delete_consent(user_id, consent_id)
    ensure_token!

    response = HTTParty.delete(
      "#{BASE_URL}/users/#{user_id}/consents/#{consent_id}",
      headers: auth_headers,
      timeout: 30
    )

    if response.code == 204 || response.success?
      Rails.logger.info("[Basiq] Consent revoked: #{consent_id}")
      { success: true }
    else
      { success: false, error: parse_error(response) }
    end
  end

  # ============================================
  # CONNECTIONS (Bank Connections)
  # ============================================

  # List all connections for a user
  # @param user_id [String] - The Basiq user ID
  def list_connections(user_id)
    ensure_token!

    response = make_request(:get, "/users/#{user_id}/connections")

    if response[:success]
      connections = response[:data]["data"] || []
      {
        success: true,
        connections: connections.map do |conn|
          {
            id: conn["id"],
            status: conn["status"],
            institution: {
              id: conn.dig("institution", "id"),
              name: conn.dig("institution", "shortName") || conn.dig("institution", "name")
            },
            last_used: conn["lastUsed"],
            created_at: conn["createdDate"]
          }
        end
      }
    else
      { success: false, error: response[:error] }
    end
  end

  # Get a specific connection
  def get_connection(user_id, connection_id)
    ensure_token!
    make_request(:get, "/users/#{user_id}/connections/#{connection_id}")
  end

  # Refresh a connection (trigger new data fetch)
  def refresh_connection(user_id, connection_id)
    ensure_token!
    make_request(:post, "/users/#{user_id}/connections/#{connection_id}/refresh", {})
  end

  # Delete a connection
  def delete_connection(user_id, connection_id)
    ensure_token!

    response = HTTParty.delete(
      "#{BASE_URL}/users/#{user_id}/connections/#{connection_id}",
      headers: auth_headers,
      timeout: 30
    )

    if response.code == 204 || response.success?
      Rails.logger.info("[Basiq] Connection deleted: #{connection_id}")
      { success: true }
    else
      { success: false, error: parse_error(response) }
    end
  end

  # ============================================
  # ACCOUNTS
  # ============================================

  # List all accounts for a user (across all connections)
  # @param user_id [String] - The Basiq user ID
  # @return [Hash] { success: true, accounts: [...] }
  def list_accounts(user_id)
    ensure_token!

    response = make_request(:get, "/users/#{user_id}/accounts")

    if response[:success]
      accounts = response[:data]["data"] || []
      {
        success: true,
        accounts: accounts.map do |acc|
          {
            id: acc["id"],
            account_no: acc["accountNo"],
            name: acc["name"],
            currency: acc["currency"],
            balance: acc["balance"]&.to_f,
            available_funds: acc["availableFunds"]&.to_f,
            account_type: acc["class"]&.dig("type"),
            product: acc["class"]&.dig("product"),
            institution: {
              id: acc.dig("institution", "id"),
              name: acc.dig("institution", "shortName") || acc.dig("institution", "name")
            },
            connection_id: acc["connection"],
            last_updated: acc["lastUpdated"],
            status: acc["status"]
          }
        end
      }
    else
      { success: false, error: response[:error] }
    end
  end

  # Get a specific account
  def get_account(user_id, account_id)
    ensure_token!
    make_request(:get, "/users/#{user_id}/accounts/#{account_id}")
  end

  # ============================================
  # TRANSACTIONS
  # ============================================

  # List transactions for a user
  # @param user_id [String] - The Basiq user ID
  # @param options [Hash] - Filter options
  #   - :account_id [String] - Filter by account
  #   - :from [Date] - Start date
  #   - :to [Date] - End date
  #   - :limit [Integer] - Max results (default 500)
  #
  # @return [Hash] { success: true, transactions: [...] }
  def list_transactions(user_id, options = {})
    ensure_token!

    # Build query params
    params = {}
    params["filter"] = build_transaction_filter(options) if options.any?
    params["limit"] = options[:limit] || 500

    response = make_request(:get, "/users/#{user_id}/transactions", params)

    if response[:success]
      transactions = response[:data]["data"] || []
      {
        success: true,
        transactions: transactions.map { |txn| normalize_transaction(txn) },
        count: transactions.length,
        has_more: response[:data]["links"]&.key?("next")
      }
    else
      { success: false, error: response[:error] }
    end
  end

  # Get a specific transaction
  def get_transaction(user_id, transaction_id)
    ensure_token!
    make_request(:get, "/users/#{user_id}/transactions/#{transaction_id}")
  end

  # ============================================
  # INSTITUTIONS (Bank List)
  # ============================================

  # List supported financial institutions
  # @return [Hash] { success: true, institutions: [...] }
  def list_institutions
    ensure_token!

    response = make_request(:get, "/institutions")

    if response[:success]
      institutions = response[:data]["data"] || []
      {
        success: true,
        institutions: institutions.map do |inst|
          {
            id: inst["id"],
            name: inst["name"],
            short_name: inst["shortName"],
            country: inst["country"],
            service_type: inst["serviceType"],
            logo_url: inst.dig("logo", "links", "square"),
            authorization_type: inst["authorization"],
            features: inst["features"]
          }
        end,
        count: institutions.length
      }
    else
      { success: false, error: response[:error] }
    end
  end

  # Get a specific institution
  def get_institution(institution_id)
    ensure_token!
    make_request(:get, "/institutions/#{institution_id}")
  end

  # ============================================
  # JOB STATUS (for async operations)
  # ============================================

  # Get job status (for async operations like connection refresh)
  def get_job(job_id)
    ensure_token!
    make_request(:get, "/jobs/#{job_id}")
  end

  # ============================================
  # CONNECTION TESTING
  # ============================================

  # Test the Basiq connection
  # @return [Hash] { success: true, connected: true, ... }
  def test_connection
    result = get_access_token

    if result[:success]
      # Try to list institutions as a sanity check
      institutions = list_institutions
      {
        success: true,
        connected: true,
        message: "Connected to Basiq API",
        institutions_count: institutions[:count] || 0
      }
    else
      {
        success: false,
        connected: false,
        error: result[:error]
      }
    end
  rescue StandardError => e
    {
      success: false,
      connected: false,
      error: e.message
    }
  end

  private

  def auth_headers
    {
      "Authorization" => "Bearer #{@access_token}",
      "Content-Type" => "application/json",
      "Accept" => "application/json",
      "basiq-version" => "3.0"
    }
  end

  def make_request(method, endpoint, data = {})
    url = "#{BASE_URL}#{endpoint}"

    response = case method
    when :get
      HTTParty.get(url, headers: auth_headers, query: data, timeout: 30)
    when :post
      HTTParty.post(url, headers: auth_headers, body: data.to_json, timeout: 30)
    when :put
      HTTParty.put(url, headers: auth_headers, body: data.to_json, timeout: 30)
    when :patch
      HTTParty.patch(url, headers: auth_headers, body: data.to_json, timeout: 30)
    else
      raise ArgumentError, "Unsupported HTTP method: #{method}"
    end

    handle_response(response)
  rescue Net::ReadTimeout => e
    Rails.logger.error("[Basiq] Request timeout: #{e.message}")
    { success: false, error: "Request timeout" }
  rescue StandardError => e
    Rails.logger.error("[Basiq] Request failed: #{e.message}")
    { success: false, error: e.message }
  end

  def handle_response(response)
    case response.code
    when 200..299
      {
        success: true,
        data: JSON.parse(response.body)
      }
    when 401
      Rails.logger.error("[Basiq] Authentication failed (401)")
      raise AuthenticationError, "Authentication failed - check BASIQ_API_KEY"
    when 403
      error = parse_error(response)
      Rails.logger.error("[Basiq] Forbidden (403): #{error}")
      { success: false, error: "Access denied: #{error}" }
    when 404
      { success: false, error: "Resource not found" }
    when 429
      retry_after = response.headers["Retry-After"]&.to_i || 60
      Rails.logger.warn("[Basiq] Rate limited, retry after #{retry_after}s")
      raise RateLimitError, "Rate limit exceeded. Retry after #{retry_after} seconds"
    when 400..499
      error = parse_error(response)
      Rails.logger.error("[Basiq] Client error (#{response.code}): #{error}")
      { success: false, error: error }
    when 500..599
      Rails.logger.error("[Basiq] Server error (#{response.code})")
      { success: false, error: "Basiq server error (#{response.code})" }
    else
      Rails.logger.error("[Basiq] Unexpected response (#{response.code})")
      { success: false, error: "Unexpected response: #{response.code}" }
    end
  end

  def parse_error(response)
    body = JSON.parse(response.body) rescue {}

    # Basiq error format
    if body["correlationId"].present?
      errors = body["data"] || []
      error_messages = errors.map { |e| e["detail"] || e["title"] }.compact
      return error_messages.join(", ") if error_messages.any?
    end

    # Generic error parsing
    body["message"] || body["error"] || body["detail"] || "Unknown error"
  end

  def build_transaction_filter(options)
    filters = []

    if options[:account_id].present?
      filters << "account.id.eq('#{options[:account_id]}')"
    end

    if options[:from].present?
      filters << "transaction.postDate.gteq('#{options[:from].to_date}')"
    end

    if options[:to].present?
      filters << "transaction.postDate.lteq('#{options[:to].to_date}')"
    end

    filters.join(",")
  end

  def normalize_transaction(txn)
    {
      id: txn["id"],
      account_id: txn["account"],
      amount: txn["amount"]&.to_f,
      direction: txn["direction"],  # "credit" or "debit"
      status: txn["status"],
      description: txn["description"],
      class: txn["class"],  # Transaction category
      post_date: txn["postDate"],
      transaction_date: txn["transactionDate"],
      balance: txn["balance"]&.to_f,
      institution: txn["institution"],
      connection_id: txn["connection"],
      enrich: txn["enrich"]  # Enriched merchant data if available
    }
  end
end
