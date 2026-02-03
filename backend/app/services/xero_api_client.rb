require "oauth2"
require "httparty"
require "base64"

class XeroApiClient
  include HTTParty

  BASE_URL = "https://api.xero.com/api.xro/2.0"
  AUTH_URL = "https://login.xero.com/identity/connect/authorize"
  TOKEN_URL = "https://identity.xero.com/connect/token"
  CONNECTIONS_URL = "https://api.xero.com/connections"

  # Custom error classes
  class ApiError < StandardError; end
  class AuthenticationError < StandardError; end
  class RateLimitError < StandardError; end

  # Allowed origins for dynamic redirect_uri
  # Must match exactly what's registered in Xero Developer Portal
  ALLOWED_ORIGINS = [
    "https://teeem.vercel.app",
    "https://teeem-staging.vercel.app",
    "https://teeem-beta.vercel.app",
    "https://teeemrob.vercel.app"
  ].freeze

  def initialize(redirect_uri: nil, teeem_tenant: nil)
    @client_id = ENV["XERO_CLIENT_ID"]
    @client_secret = ENV["XERO_CLIENT_SECRET"]
    @redirect_uri = redirect_uri || ENV["XERO_REDIRECT_URI"]
    @teeem_tenant = teeem_tenant

    raise AuthenticationError, "Missing Xero credentials in environment" unless credentials_present?
  end

  # Build redirect_uri from origin if origin is whitelisted
  def self.redirect_uri_for_origin(origin)
    return nil unless origin.present?
    return nil unless ALLOWED_ORIGINS.include?(origin)
    "#{origin}/xero/callback"
  end

  # OAuth scopes for Xero API access
  # - offline_access: Required for refresh tokens
  # - accounting.transactions: Read/write invoices, bills, credit notes
  # - accounting.contacts: Read/write contacts
  # - accounting.settings: Read tax rates, tracking categories
  # - accounting.attachments: Read/write attachments (upgraded from .read for two-way sync)
  # - accounting.reports.read: Read financial reports (P&L, Balance Sheet)
  OAUTH_SCOPES = "offline_access accounting.transactions accounting.contacts accounting.settings accounting.attachments accounting.reports.read"

  # Generate OAuth authorization URL
  def authorization_url
    client = oauth_client
    client.auth_code.authorize_url(
      redirect_uri: @redirect_uri,
      scope: OAUTH_SCOPES
    )
  end

  # Generate OAuth authorization URL for a specific company
  # Includes company_id in state parameter for callback verification
  def authorization_url_for_company(company_id)
    client = oauth_client
    client.auth_code.authorize_url(
      redirect_uri: @redirect_uri,
      scope: OAUTH_SCOPES,
      state: "company_#{company_id}"
    )
  end

  # Exchange authorization code for access token
  # Creates XeroCredential records for ALL authorized organizations
  #
  # @param code [String] OAuth authorization code
  # @param teeem_tenant [Tenant] Optional TEEEM tenant to associate credentials with (for multi-tenancy)
  def exchange_code_for_token(code, teeem_tenant: nil)
    begin
      client = oauth_client
      token = client.auth_code.get_token(code, redirect_uri: @redirect_uri)

      # Get tenant information
      tenant_info = get_tenant_info(token.token)

      if tenant_info.empty?
        raise ApiError, "No Xero organization connected"
      end

      # Create credentials for ALL authorized organizations
      credentials_created = []
      tenant_info.each do |tenant|
        # Find or create credential for this tenant
        credential = XeroCredential.find_or_initialize_by(tenant_id: tenant["tenantId"])
        credential.assign_attributes(
          access_token: token.token,
          refresh_token: token.refresh_token,
          expires_at: Time.current + token.expires_in.seconds,
          tenant_name: tenant["tenantName"],
          tenant_type: tenant["tenantType"],
          teeem_tenant_id: teeem_tenant&.id || credential.teeem_tenant_id
        )
        credential.save!

        # SSoT: Reset status to connected after successful OAuth (fixes degraded state)
        credential.reconnect!

        credentials_created << credential

        Rails.logger.info("Xero OAuth successful: #{tenant['tenantName']} (#{tenant['tenantId']})")
      end

      # Return info about all created credentials
      {
        success: true,
        organizations_count: credentials_created.count,
        organizations: credentials_created.map { |c|
          {
            tenant_id: c.tenant_id,
            tenant_name: c.tenant_name,
            expires_at: c.expires_at
          }
        },
        # Keep backwards compatibility - return first org details
        tenant_name: credentials_created.first.tenant_name,
        tenant_id: credentials_created.first.tenant_id,
        expires_at: credentials_created.first.expires_at
      }
    rescue OAuth2::Error => e
      Rails.logger.error("Xero OAuth error: #{e.message}")
      raise AuthenticationError, "Failed to exchange code: #{e.message}"
    rescue StandardError => e
      Rails.logger.error("Xero token exchange error: #{e.message}")
      raise ApiError, "Token exchange failed: #{e.message}"
    end
  end

  # Exchange authorization code for access token for a specific company
  # Stores tokens in CorporateXeroConnection instead of XeroCredential
  def exchange_code_for_company_token(code, company)
    begin
      client = oauth_client
      token = client.auth_code.get_token(code, redirect_uri: @redirect_uri)

      # Get tenant information
      tenant_info = get_tenant_info(token.token)

      if tenant_info.empty?
        raise ApiError, "No Xero organization connected"
      end

      # Use the first organization (or let user select later)
      tenant = tenant_info.first

      # Find or create the company's Xero connection
      connection = company.corporate_xero_connection || company.build_corporate_xero_connection

      # Update connection with OAuth tokens
      connection.connect!(
        access_token: token.token,
        refresh_token: token.refresh_token,
        expires_at: Time.current + token.expires_in.seconds,
        tenant_id: tenant["tenantId"],
        tenant_name: tenant["tenantName"]
      )

      Rails.logger.info("Xero OAuth successful for company #{company.id}: #{tenant['tenantName']} (#{tenant['tenantId']})")

      {
        success: true,
        tenant_name: tenant["tenantName"],
        tenant_id: tenant["tenantId"],
        expires_at: connection.token_expires_at
      }
    rescue OAuth2::Error => e
      Rails.logger.error("Xero OAuth error for company #{company.id}: #{e.message}")
      raise AuthenticationError, "Failed to exchange code: #{e.message}"
    rescue StandardError => e
      Rails.logger.error("Xero token exchange error for company #{company.id}: #{e.message}")
      raise ApiError, "Token exchange failed: #{e.message}"
    end
  end

  # Refresh the access token
  # DELEGATES TO XeroTokenManager - Single Source of Truth for token operations
  def refresh_access_token
    credential = XeroCredential.current
    return { success: false, error: "No credentials found" } unless credential

    refresh_access_token_for(credential)
  end

  # Refresh the access token for a specific credential (multi-tenant support)
  # DELEGATES TO XeroTokenManager - Single Source of Truth for token operations
  #
  # XeroTokenManager handles:
  # - 30-minute grace period retry (Xero allows retrying same refresh token)
  # - Transaction safety with retry on DB failures
  # - Poisoned token detection (burned tokens that will never work)
  # - Proactive refresh buffer (15 min before expiry)
  # - PostgreSQL advisory locks for concurrent safety
  def refresh_access_token_for(credential)
    return { success: false, error: "No credentials provided" } unless credential

    # Delegate to XeroTokenManager - the Single Source of Truth
    result = XeroTokenManager.refresh_credential(credential)

    if result[:success]
      { success: true, expires_at: result[:expires_at] }
    else
      # If token is poisoned, raise a specific error
      if result[:poisoned]
        raise AuthenticationError, "Xero token is poisoned. Please reconnect to Xero."
      else
        raise AuthenticationError, "Failed to refresh token: #{result[:error]}"
      end
    end
  end

  # Refresh the access token for a CorporateXeroConnection
  def refresh_access_token_for_connection(connection)
    return { success: false, error: "No connection provided" } unless connection

    begin
      # Try to access encrypted fields to check if decryption works
      access_token = connection.access_token
      refresh_token_value = connection.refresh_token
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Xero connection decryption failed for company #{connection.company_id}: #{e.message}")
      return { success: false, error: "Credentials corrupted. Please reconnect to Xero." }
    end

    return { success: false, error: "No refresh token available" } if refresh_token_value.blank?

    begin
      client = oauth_client
      old_token = OAuth2::AccessToken.new(
        client,
        access_token,
        refresh_token: refresh_token_value
      )

      new_token = old_token.refresh!

      Rails.logger.info("Xero token refreshed successfully for company #{connection.company_id}")

      {
        success: true,
        access_token: new_token.token,
        refresh_token: new_token.refresh_token,
        expires_at: Time.current + new_token.expires_in.seconds
      }
    rescue OAuth2::Error => e
      Rails.logger.error("Xero token refresh error for company #{connection.company_id}: #{e.message}")
      { success: false, error: "Failed to refresh token: #{e.message}" }
    end
  end

  # Get available tenants for a CorporateXeroConnection
  def get_tenants_for_connection(connection)
    return [] unless connection&.access_token.present?

    # Refresh if needed
    if connection.needs_refresh?
      result = refresh_access_token_for_connection(connection)
      unless result[:success]
        raise AuthenticationError, result[:error]
      end
      connection.reload
    end

    tenant_info = get_tenant_info(connection.access_token)

    tenant_info.map do |tenant|
      {
        tenant_id: tenant["tenantId"],
        tenant_name: tenant["tenantName"],
        tenant_type: tenant["tenantType"]
      }
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

  # Check connection status across all Xero credentials
  # SSoT: Uses XeroConnectionHealth service for individual credential health
  def connection_status
    # Multi-tenancy: Filter by TEEEM tenant
    # Master tenant sees all; other tenants only see their own Xero orgs
    all_credentials = if @teeem_tenant&.master_tenant?
                        XeroCredential.all
                      elsif @teeem_tenant
                        XeroCredential.for_teeem_tenant(@teeem_tenant)
                      else
                        XeroCredential.all  # Fallback for backward compatibility
                      end

    if all_credentials.empty?
      return {
        connected: false,
        status: "disconnected",
        display_status: "disconnected",
        message: "Not connected to Xero"
      }
    end

    # SSoT: Use XeroConnectionHealth for each credential
    # Key insight: health.connected == true even when display_status == "warning" or "rate_limited"
    # A credential in "warning" or "rate_limited" state is still WORKING (just needs attention/waiting)
    total = all_credentials.count
    working_count = 0         # health.connected == true (includes warning/rate_limited state)
    fully_healthy_count = 0   # display_status == "connected" (no issues)
    needs_attention_count = 0 # needs_attention == true
    rate_limited_count = 0    # FRC: Track rate-limited credentials separately

    all_credentials.each do |cred|
      health = XeroConnectionHealth.for_credential(cred)
      # SSoT: Use health.connected to determine if credential is working
      # This correctly considers "warning" and "rate_limited" states as working
      working_count += 1 if health.connected
      fully_healthy_count += 1 if health.display_status == "connected"
      needs_attention_count += 1 if health.needs_attention
      rate_limited_count += 1 if health.display_status == "rate_limited"
    end

    # Aggregate status:
    # - NO working connections → disconnected (red, needs immediate attention)
    # - SOME working but needs attention → warning (orange, degraded)
    # - SOME rate limited → rate_limited (orange, syncing paused)
    # - ALL fully healthy → connected (green)
    has_working = working_count > 0

    if !has_working || total == 0
      # No working connections - red
      {
        connected: false,
        status: "disconnected",
        display_status: "disconnected",
        message: "All Xero connections require re-authentication.",
        total: total,
        connected_count: working_count,
        needs_attention: needs_attention_count
      }
    elsif needs_attention_count > 0
      # Some working but needs attention - orange (degraded but functional)
      primary = XeroCredential.current
      {
        connected: true,
        status: "degraded",
        display_status: "warning",
        message: "#{needs_attention_count} of #{total} Xero connections need attention.",
        tenant_name: primary&.tenant_name,
        tenant_id: primary&.tenant_id,
        total: total,
        connected_count: working_count,
        needs_attention: needs_attention_count
      }
    elsif rate_limited_count > 0
      # FRC: Some working but rate limited - orange (syncing paused)
      primary = XeroCredential.current
      primary_health = primary ? XeroConnectionHealth.for_credential(primary) : nil
      {
        connected: true,
        status: "rate_limited",
        display_status: "rate_limited",
        message: rate_limited_count == 1 ? (primary_health&.message || "Rate limit reached - syncing paused") : "#{rate_limited_count} of #{total} Xero orgs are rate limited. Resets 10:00 AM Brisbane.",
        tenant_name: primary&.tenant_name,
        tenant_id: primary&.tenant_id,
        total: total,
        connected_count: working_count,
        needs_attention: 0,
        rate_limited: rate_limited_count
      }
    else
      # Credentials all good - now check sync health for orange indicator
      primary = XeroCredential.current
      primary_health = primary ? XeroConnectionHealth.for_credential(primary) : nil

      # SSoT: Check sync health - show orange if any sync is stalled
      sync_health = XeroSyncStatus.health_summary
      sync_stalled = sync_health[:overall_health] == "red" || sync_health[:overall_health] == "yellow"

      # Determine specific sync issue for message
      sync_issue_message = nil
      if sync_stalled
        stalled_types = []
        sync_health[:sync_types]&.each do |type, info|
          if info[:health_status] == "red" || info[:health_status] == "yellow"
            stalled_types << type
          end
        end
        sync_issue_message = "Sync stalled: #{stalled_types.join(', ')}" if stalled_types.any?
      end

      if sync_stalled
        # Credentials connected but sync is stalled - orange
        {
          connected: true,
          status: "degraded",
          display_status: "warning",
          message: sync_issue_message || "Sync health degraded",
          tenant_name: primary&.tenant_name,
          tenant_id: primary&.tenant_id,
          expires_at: primary_health&.expires_at,
          expired: primary&.expired?,
          total: total,
          connected_count: working_count,
          needs_attention: 0,
          sync_stalled: true,
          sync_health: sync_health[:overall_health]
        }
      else
        # All good - green
        {
          connected: true,
          status: "connected",
          display_status: "connected",
          tenant_name: primary&.tenant_name,
          tenant_id: primary&.tenant_id,
          expires_at: primary_health&.expires_at,
          expired: primary&.expired?,
          total: total,
          connected_count: working_count,
          needs_attention: 0,
          sync_stalled: false,
          sync_health: "green"
        }
      end
    end
  end

  # Disconnect from Xero (revoke tokens)
  def disconnect
    credential = XeroCredential.current
    return { success: false, error: "Not connected" } unless credential

    begin
      # Revoke the refresh token with Xero
      # This will invalidate all tokens and disconnect the app
      revoke_token(credential.refresh_token)

      # Delete our stored credentials
      credential.destroy

      Rails.logger.info("Xero disconnected successfully - tokens revoked and credentials deleted")

      { success: true, message: "Disconnected from Xero" }
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
        "https://identity.xero.com/connect/revocation",
        headers: {
          "Authorization" => "Basic #{auth_header}",
          "Content-Type" => "application/x-www-form-urlencoded"
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
  # SSoT: Returns data directly without persisting (XeroTaxRate table was deprecated)
  # For persistent storage, use Gl::TaxRate with external_provider: 'xero'
  def get_tax_rates
    response = make_request(:get, "TaxRates")

    if response[:success]
      tax_rates = (response[:data]["TaxRates"] || [])
        .select { |rate| rate["Status"] == "ACTIVE" }
        .sort_by { |rate| rate["Name"] }
        .map do |rate|
          OpenStruct.new(
            code: rate["TaxType"],
            name: rate["Name"],
            rate: rate["EffectiveRate"],
            display_rate: rate["DisplayTaxRate"],
            tax_type: rate["TaxType"],
            active: true
          )
        end

      { success: true, tax_rates: tax_rates }
    else
      { success: false, error: "Failed to fetch tax rates from Xero" }
    end
  rescue StandardError => e
    Rails.logger.error("Error fetching Xero tax rates: #{e.message}")
    { success: false, error: e.message }
  end

  # Fetch chart of accounts from Xero
  def get_accounts
    response = make_request(:get, "Accounts")

    if response[:success]
      accounts = response[:data]["Accounts"] || []

      # Update local database
      accounts.each do |account|
        # Skip accounts without a code or name
        next if account["Code"].blank? || account["Name"].blank?

        XeroAccount.find_or_initialize_by(code: account["Code"]).tap do |xero_account|
          xero_account.name = account["Name"]
          xero_account.account_type = account["Type"]
          xero_account.tax_type = account["TaxType"]
          xero_account.description = account["Description"]
          xero_account.active = account["Status"] == "ACTIVE"
          xero_account.account_class = account["Class"]
          xero_account.system_account = account["SystemAccount"] || false
          xero_account.enable_payments_to_account = account["EnablePaymentsToAccount"] || false
          xero_account.show_in_expense_claims = account["ShowInExpenseClaims"] || false
          xero_account.save!
        end
      end

      { success: true, accounts: XeroAccount.active.order(:code) }
    else
      { success: false, error: "Failed to fetch accounts from Xero" }
    end
  rescue StandardError => e
    Rails.logger.error("Error fetching Xero accounts: #{e.message}")
    { success: false, error: e.message }
  end

  # Update a Xero account name
  # @param account_id [String] - The Xero Account UUID
  # @param new_name [String] - The new name for the account
  # @param options [Hash] - Options including :tenant_id for multi-tenant support
  # @return [Hash] - { success: true, account: {...} } or { success: false, error: ... }
  def update_account_name(account_id, new_name, options = {})
    raise ArgumentError, "account_id required" unless account_id.present?
    raise ArgumentError, "new_name required" unless new_name.present?

    payload = {
      "AccountID" => account_id,
      "Name" => new_name
    }

    response = make_request(:post, "Accounts/#{account_id}", payload, options)

    if response[:success]
      account = response[:data]["Accounts"]&.first
      Rails.logger.info("Updated Xero account #{account_id} name to: #{new_name}")
      { success: true, account: account }
    else
      { success: false, error: response[:error] || "Failed to update account" }
    end
  rescue StandardError => e
    Rails.logger.error("Error updating Xero account: #{e.message}")
    { success: false, error: e.message }
  end

  # ============================================
  # REPORT METHODS (P&L, Balance Sheet)
  # ============================================

  # Fetch Profit & Loss report from Xero
  # @param connection [CorporateXeroConnection] - The company's Xero connection
  # @param from_date [Date] - Start date of the report period
  # @param to_date [Date] - End date of the report period
  # @return [Hash] - { success: true, report: {...} } or { success: false, error: ... }
  def get_profit_and_loss(connection, from_date:, to_date:)
    raise ArgumentError, "Connection required" unless connection
    raise ArgumentError, "from_date required" unless from_date
    raise ArgumentError, "to_date required" unless to_date

    # Refresh tokens if needed
    if connection.needs_refresh?
      unless connection.refresh_tokens!
        return { success: false, error: "Failed to refresh Xero tokens. Please reconnect." }
      end
    end

    response = get(
      "Reports/ProfitAndLoss",
      tenant_id: connection.xero_tenant_id,
      fromDate: from_date.to_s,
      toDate: to_date.to_s
    )

    if response[:success]
      reports = response[:data]["Reports"] || []
      report = reports.first

      if report.nil?
        { success: false, error: "No P&L report returned from Xero" }
      else
        { success: true, report: report }
      end
    else
      { success: false, error: response[:error] || "Failed to fetch P&L from Xero" }
    end
  rescue StandardError => e
    Rails.logger.error("Error fetching Xero P&L: #{e.message}")
    { success: false, error: e.message }
  end

  # Fetch Balance Sheet report from Xero
  # @param connection [CorporateXeroConnection] - The company's Xero connection
  # @param as_at_date [Date] - The date for the balance sheet
  # @return [Hash] - { success: true, report: {...} } or { success: false, error: ... }
  def get_balance_sheet(connection, as_at_date:)
    raise ArgumentError, "Connection required" unless connection
    raise ArgumentError, "as_at_date required" unless as_at_date

    # Refresh tokens if needed
    if connection.needs_refresh?
      unless connection.refresh_tokens!
        return { success: false, error: "Failed to refresh Xero tokens. Please reconnect." }
      end
    end

    response = get(
      "Reports/BalanceSheet",
      tenant_id: connection.xero_tenant_id,
      date: as_at_date.to_s
    )

    if response[:success]
      reports = response[:data]["Reports"] || []
      report = reports.first

      if report.nil?
        { success: false, error: "No Balance Sheet report returned from Xero" }
      else
        { success: true, report: report }
      end
    else
      { success: false, error: response[:error] || "Failed to fetch Balance Sheet from Xero" }
    end
  rescue StandardError => e
    Rails.logger.error("Error fetching Xero Balance Sheet: #{e.message}")
    { success: false, error: e.message }
  end

  # ============================================
  # ATTACHMENT METHODS (for Data Warehouse sync)
  # ============================================

  # Get list of attachments for an entity (Invoice, Bill, etc.)
  # @param entity_type [String] - 'Invoices', 'CreditNotes', 'BankTransactions', etc.
  # @param entity_id [String] - The Xero GUID of the entity
  # @param options [Hash] - :tenant_id to specify which tenant
  # @return [Hash] - { success: true, attachments: [...] } or { success: false, error: ... }
  def get_attachments(entity_type, entity_id, options = {})
    endpoint = "#{entity_type}/#{entity_id}/Attachments"
    response = make_request(:get, endpoint, {}, options)

    if response[:success]
      attachments = response[:data]["Attachments"] || []
      {
        success: true,
        attachments: attachments.map do |att|
          {
            attachment_id: att["AttachmentID"],
            filename: att["FileName"],
            url: att["Url"],
            mime_type: att["MimeType"],
            content_length: att["ContentLength"],
            include_online: att["IncludeOnline"]
          }
        end
      }
    else
      { success: false, error: "Failed to fetch attachments" }
    end
  rescue StandardError => e
    Rails.logger.error("[Xero] Error fetching attachments for #{entity_type}/#{entity_id}: #{e.message}")
    { success: false, error: e.message }
  end

  # Download a specific attachment's content
  # @param entity_type [String] - 'Invoices', 'CreditNotes', etc.
  # @param entity_id [String] - The Xero GUID of the entity
  # @param filename [String] - The filename of the attachment
  # @param options [Hash] - :tenant_id to specify which tenant
  # @return [Hash] - { success: true, content: binary_data, filename: ..., mime_type: ... }
  def download_attachment(entity_type, entity_id, filename, options = {})
    endpoint = "#{entity_type}/#{entity_id}/Attachments/#{ERB::Util.url_encode(filename)}"

    # Make raw binary request (not JSON)
    make_binary_request(:get, endpoint, options)
  rescue StandardError => e
    Rails.logger.error("[Xero] Error downloading attachment #{filename}: #{e.message}")
    { success: false, error: e.message }
  end

  # Get an invoice as a PDF
  # Xero can generate PDFs for invoices directly via Accept: application/pdf header
  # @param invoice_id [String] - The Xero Invoice GUID
  # @param options [Hash] - :tenant_id to specify which tenant
  # @return [Hash] - { success: true, content: binary_pdf, filename: "INV-XXX.pdf" }
  def get_invoice_pdf(invoice_id, options = {})
    endpoint = "Invoices/#{invoice_id}"

    result = make_binary_request(:get, endpoint, options.merge(accept: "application/pdf"))

    if result[:success]
      # Set a sensible filename based on invoice number if we can get it
      result[:filename] ||= "Invoice-#{invoice_id[0..7]}.pdf"
      result[:mime_type] = "application/pdf"
    end

    result
  rescue RateLimitError => e
    # Re-raise rate limit errors so caller can implement backoff
    raise e
  rescue StandardError => e
    Rails.logger.error("[Xero] Error fetching PDF for invoice #{invoice_id}: #{e.message}")
    { success: false, error: e.message }
  end

  # Get a quote as a PDF
  # @param quote_id [String] - The Xero Quote GUID
  # @param options [Hash] - :tenant_id to specify which tenant
  def get_quote_pdf(quote_id, options = {})
    endpoint = "Quotes/#{quote_id}"

    result = make_binary_request(:get, endpoint, options.merge(accept: "application/pdf"))

    if result[:success]
      result[:filename] ||= "Quote-#{quote_id[0..7]}.pdf"
      result[:mime_type] = "application/pdf"
    end

    result
  rescue RateLimitError => e
    # Re-raise rate limit errors so caller can implement backoff
    raise e
  rescue StandardError => e
    Rails.logger.error("[Xero] Error fetching PDF for quote #{quote_id}: #{e.message}")
    { success: false, error: e.message }
  end

  # Get a credit note as a PDF
  # @param credit_note_id [String] - The Xero CreditNote GUID
  # @param options [Hash] - :tenant_id to specify which tenant
  def get_credit_note_pdf(credit_note_id, options = {})
    endpoint = "CreditNotes/#{credit_note_id}"

    result = make_binary_request(:get, endpoint, options.merge(accept: "application/pdf"))

    if result[:success]
      result[:filename] ||= "CreditNote-#{credit_note_id[0..7]}.pdf"
      result[:mime_type] = "application/pdf"
    end

    result
  rescue RateLimitError => e
    # Re-raise rate limit errors so caller can implement backoff
    raise e
  rescue StandardError => e
    Rails.logger.error("[Xero] Error fetching PDF for credit note #{credit_note_id}: #{e.message}")
    { success: false, error: e.message }
  end

  # Upload an attachment to a Xero entity (invoice, contact, etc.)
  # Requires accounting.attachments scope (not just .read)
  #
  # @param entity_type [String] - The entity type (Invoices, Contacts, BankTransactions, etc.)
  # @param entity_id [String] - The Xero entity GUID
  # @param filename [String] - The filename for the attachment
  # @param file_content [String] - The binary file content
  # @param options [Hash] - Optional parameters
  #   - :tenant_id [String] - Specific tenant to use
  #   - :content_type [String] - MIME type (default: application/octet-stream)
  #   - :include_online [Boolean] - Whether to include in online invoice (default: false)
  #
  # @return [Hash] - { success: true, attachment_id: '...', ... } or { success: false, error: '...' }
  def upload_attachment(entity_type, entity_id, filename, file_content, options = {})
    tenant_id = options[:tenant_id]
    content_type = options[:content_type] || guess_content_type(filename)
    include_online = options[:include_online] || false

    # Find credential
    credential = find_credential_for_tenant(tenant_id)
    unless credential
      return { success: false, error: "No Xero credential available" }
    end

    # Ensure token is valid
    ensure_token_valid!(credential)

    # Build the upload URL
    # Xero attachment endpoint: PUT {EntityType}/{EntityGuid}/Attachments/{Filename}
    url = "#{BASE_URL}/#{entity_type}/#{entity_id}/Attachments/#{CGI.escape(filename)}"

    # Add query param for online invoices
    url += "?IncludeOnline=true" if include_online && entity_type == "Invoices"

    request_tenant_id = credential.respond_to?(:xero_tenant_id) ? credential.xero_tenant_id : credential.tenant_id

    headers = {
      "Authorization" => "Bearer #{credential.access_token}",
      "Xero-tenant-id" => request_tenant_id,
      "Content-Type" => content_type,
      "Content-Length" => file_content.bytesize.to_s
    }

    Rails.logger.info("[Xero] Uploading attachment #{filename} to #{entity_type}/#{entity_id}")

    response = HTTParty.put(
      url,
      headers: headers,
      body: file_content,
      timeout: 60
    )

    if response.success?
      data = JSON.parse(response.body) rescue {}
      attachment = data["Attachments"]&.first

      Rails.logger.info("[Xero] Attachment uploaded successfully: #{attachment&.dig('AttachmentID')}")

      {
        success: true,
        attachment_id: attachment&.dig("AttachmentID"),
        filename: attachment&.dig("FileName"),
        url: attachment&.dig("Url"),
        content_length: attachment&.dig("ContentLength"),
        include_online: attachment&.dig("IncludeOnline")
      }
    elsif response.code == 429
      retry_after = response.headers["Retry-After"]&.to_i || 60
      raise RateLimitError, "Rate limited, retry after #{retry_after} seconds"
    else
      error_body = JSON.parse(response.body) rescue {}
      error_message = error_body["Message"] || error_body["Detail"] || "Upload failed with status #{response.code}"
      Rails.logger.error("[Xero] Attachment upload failed: #{error_message}")
      { success: false, error: error_message, status: response.code }
    end
  rescue RateLimitError
    raise
  rescue StandardError => e
    Rails.logger.error("[Xero] Error uploading attachment #{filename}: #{e.message}")
    { success: false, error: e.message }
  end

  private

  # Find the appropriate credential for a tenant
  def find_credential_for_tenant(tenant_id)
    if tenant_id.present?
      CorporateXeroConnection.find_by(xero_tenant_id: tenant_id) ||
        XeroCredential.find_by(tenant_id: tenant_id)
    else
      XeroCredential.current
    end
  end

  # Ensure the credential has a valid token
  def ensure_token_valid!(credential)
    if credential.respond_to?(:needs_refresh?) ? credential.needs_refresh? : credential.expired?
      if credential.is_a?(CorporateXeroConnection)
        credential.refresh_tokens!
      else
        refresh_access_token_for(credential)
      end
      credential.reload
    end
  end

  # Guess content type from filename
  def guess_content_type(filename)
    ext = File.extname(filename).downcase
    case ext
    when ".pdf" then "application/pdf"
    when ".png" then "image/png"
    when ".jpg", ".jpeg" then "image/jpeg"
    when ".gif" then "image/gif"
    when ".doc" then "application/msword"
    when ".docx" then "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    when ".xls" then "application/vnd.ms-excel"
    when ".xlsx" then "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    when ".csv" then "text/csv"
    when ".txt" then "text/plain"
    else "application/octet-stream"
    end
  end

  def credentials_present?
    @client_id.present? && @client_secret.present? && @redirect_uri.present?
  end

  def oauth_client
    OAuth2::Client.new(
      @client_id,
      @client_secret,
      site: "https://login.xero.com",
      authorize_url: AUTH_URL,
      token_url: TOKEN_URL
    )
  end

  def get_tenant_info(access_token)
    response = HTTParty.get(
      CONNECTIONS_URL,
      headers: {
        "Authorization" => "Bearer #{access_token}",
        "Content-Type" => "application/json"
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
    attempts = 0
    max_attempts = 2  # Initial attempt + 1 retry after 401

    # First try to find a CorporateXeroConnection for this tenant_id (per-company connections)
    # Then fall back to XeroCredential (global job/invoice connections)
    credential = nil

    if tenant_id.present?
      # Try CorporateXeroConnection first (for corporate entity Xero integrations)
      credential = CorporateXeroConnection.find_by(xero_tenant_id: tenant_id)

      # Fall back to XeroCredential (for job/invoice Xero integrations)
      credential ||= XeroCredential.find_by(tenant_id: tenant_id)
    end

    # Default to current global credential if no tenant specified
    credential ||= XeroCredential.current

    unless credential
      raise AuthenticationError, "Not authenticated with Xero"
    end

    # Try to access encrypted fields to check if decryption works
    begin
      # This will raise ActiveRecord::Encryption::Errors::Decryption if keys are wrong
      _test_access = credential.access_token
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error("Xero credential decryption failed - deleting corrupted credentials: #{e.message}")
      # Delete the corrupted credential
      credential.destroy
      raise AuthenticationError, "Xero credentials are corrupted. Please reconnect to Xero."
    end

    # Proactive token refresh using XeroTokenManager (15 min buffer, grace period retry)
    # This is the key fix: use XeroTokenManager for ALL token validation, not the old 1-min buffer
    if credential.is_a?(CorporateXeroConnection)
      # CorporateXeroConnection delegates to XeroTokenManager via refresh_tokens!
      if credential.needs_refresh?
        credential.refresh_tokens!
      end
    else
      # XeroCredential - use XeroTokenManager directly for proactive refresh
      unless XeroTokenManager.ensure_valid_token(credential)
        raise AuthenticationError, "Xero credential is disconnected or token refresh failed"
      end
    end

    # Reload credential to get updated token
    credential.reload

    # Get tenant_id - CorporateXeroConnection uses xero_tenant_id, XeroCredential uses tenant_id
    request_tenant_id = credential.respond_to?(:xero_tenant_id) ? credential.xero_tenant_id : credential.tenant_id

    url = "#{BASE_URL}/#{endpoint}"

    loop do
      attempts += 1

      begin
        headers = {
          "Authorization" => "Bearer #{credential.access_token}",
          "Xero-tenant-id" => request_tenant_id,
          "Content-Type" => "application/json",
          "Accept" => "application/json"
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

        # Handle 401 with retry
        if response.code == 401 && attempts < max_attempts
          Rails.logger.info("[Xero] Got 401, attempting token refresh and retry...")
          if credential.is_a?(CorporateXeroConnection)
            credential.refresh_tokens!
          else
            refresh_access_token_for(credential)
          end
          credential.reload
          next  # Retry the loop
        end

        # Track the API request for rate limiting visibility
        XeroRateLimitTracker.record_request(request_tenant_id)

        return handle_response(response)
      rescue AuthenticationError => e
        # Re-raise auth errors without retry (already tried in response handling)
        raise e
      rescue Net::ReadTimeout => e
        Rails.logger.error("Xero API timeout: #{e.message}")
        raise ApiError, "Request timeout"
      rescue StandardError => e
        Rails.logger.error("Xero API error: #{e.message}")
        raise ApiError, e.message
      end
    end
  end

  # Make a binary request (for downloading PDFs/attachments)
  def make_binary_request(method, endpoint, options = {})
    tenant_id = options[:tenant_id]
    accept_type = options[:accept] || "application/octet-stream"
    attempts = 0
    max_attempts = 2  # Initial attempt + 1 retry after 401

    # Find credential (same logic as make_request)
    credential = nil
    if tenant_id.present?
      credential = CorporateXeroConnection.find_by(xero_tenant_id: tenant_id)
      credential ||= XeroCredential.find_by(tenant_id: tenant_id)
    end
    credential ||= XeroCredential.current

    unless credential
      raise AuthenticationError, "Not authenticated with Xero"
    end

    # Proactive token refresh using XeroTokenManager (15 min buffer, grace period retry)
    if credential.is_a?(CorporateXeroConnection)
      if credential.needs_refresh?
        credential.refresh_tokens!
      end
    else
      unless XeroTokenManager.ensure_valid_token(credential)
        raise AuthenticationError, "Xero credential is disconnected or token refresh failed"
      end
    end

    credential.reload

    request_tenant_id = credential.respond_to?(:xero_tenant_id) ? credential.xero_tenant_id : credential.tenant_id
    url = "#{BASE_URL}/#{endpoint}"

    loop do
      attempts += 1

      headers = {
        "Authorization" => "Bearer #{credential.access_token}",
        "Xero-tenant-id" => request_tenant_id,
        "Accept" => accept_type
      }

      response = HTTParty.get(url, headers: headers, timeout: 60)

      # Track the API request for rate limiting visibility
      XeroRateLimitTracker.record_request(request_tenant_id)

      case response.code
      when 200..299
        content_disposition = response.headers["content-disposition"]
        filename = nil
        if content_disposition.present?
          match = content_disposition.match(/filename="?([^";\s]+)"?/)
          filename = match[1] if match
        end

        return {
          success: true,
          content: response.body,
          filename: filename,
          mime_type: response.headers["content-type"],
          content_length: response.headers["content-length"]&.to_i
        }
      when 401
        # Try refreshing token once and retry
        if attempts < max_attempts
          Rails.logger.info("[Xero] Got 401, attempting token refresh and retry...")
          if credential.is_a?(CorporateXeroConnection)
            credential.refresh_tokens!
          else
            refresh_access_token_for(credential)
          end
          credential.reload
          next  # Retry the loop
        else
          raise AuthenticationError, "Authentication failed after token refresh"
        end
      when 404
        return { success: false, error: "Not found" }
      when 429
        raise RateLimitError, "Rate limit exceeded"
      else
        return { success: false, error: "Request failed with status #{response.code}" }
      end
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
      error_detail = error_body["Detail"] || error_body["message"] || "Authentication failed"
      raise AuthenticationError, "Authentication failed: #{error_detail}"
    when 404
      # Not Found - endpoint or resource doesn't exist
      Rails.logger.error("Xero API not found (404): #{response.body}")
      error_body = JSON.parse(response.body) rescue {}
      error_detail = error_body["Detail"] || error_body["message"] || "Resource not found"
      raise ApiError, "Not found: #{error_detail}"
    when 429
      # Rate limit exceeded
      retry_after = response.headers["Retry-After"] || 60
      Rails.logger.warn("Xero API rate limit hit. Retry after: #{retry_after}s")
      raise RateLimitError, "Rate limit exceeded. Retry after #{retry_after} seconds"
    when 400..499
      # Client error
      error_body = JSON.parse(response.body) rescue {}
      error_message = error_body["Message"] || error_body["message"] || error_body["Detail"] || "Client error"
      error_details = error_body["Elements"] || []

      full_error = "#{error_message}"
      if error_details.any?
        detail_messages = error_details.map { |e| e["ValidationErrors"]&.map { |v| v["Message"] } }.flatten.compact
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
