# frozen_string_literal: true

# PolarisMailService - API client for PolarisMail reseller integration
#
# Handles all communication with PolarisMail's reseller API including:
# - Account creation and management
# - Mailbox provisioning
# - Migration initiation
# - Status polling
#
# NOTE: This is a stub implementation. Update with actual API endpoints
# once PolarisMail reseller API documentation is available.
#
# Usage:
#   service = PolarisMailService.new
#   service.create_account(domain: "example.com", contact_email: "admin@example.com")
#
class PolarisMailService
  class ApiError < StandardError; end
  class NotConnectedError < StandardError; end
  class RateLimitError < StandardError; end

  # Placeholder API base URL - update when PolarisMail provides reseller API access
  API_BASE = ENV.fetch("POLARIS_API_URL", "https://api.polarismail.com/v1")

  # Rate limiting
  MAX_RETRIES = 3
  RETRY_DELAY = 2.seconds

  def initialize(credential = nil)
    @credential = credential || find_active_credential
    raise NotConnectedError, "PolarisMail not configured. Please add API credentials in Admin > System." unless @credential
  end

  # ====================
  # CONNECTION
  # ====================

  def test_connection
    response = get("/account")
    response["status"] == "active"
  rescue ApiError => e
    Rails.logger.warn "[PolarisMailService] Connection test failed: #{e.message}"
    false
  end

  # ====================
  # ACCOUNT MANAGEMENT
  # ====================

  # Create a new reseller account for a client
  # @param domain [String] Primary domain for the account
  # @param contact_email [String] Admin contact email
  # @param plan_id [String] PolarisMail plan ID (optional)
  # @return [Hash] Account details including ID
  def create_account(domain:, contact_email:, plan_id: nil)
    post("/accounts", {
      domain: domain,
      admin_email: contact_email,
      plan_id: plan_id || default_plan_id,
      reseller_id: @credential.reseller_id
    })
  end

  # Get account details
  # @param account_id [String] PolarisMail account ID
  # @return [Hash] Account details
  def get_account(account_id)
    get("/accounts/#{account_id}")
  end

  # Suspend an account
  # @param account_id [String] PolarisMail account ID
  # @param reason [String] Reason for suspension
  def suspend_account(account_id, reason:)
    post("/accounts/#{account_id}/suspend", { reason: reason })
  end

  # Reactivate a suspended account
  # @param account_id [String] PolarisMail account ID
  def reactivate_account(account_id)
    post("/accounts/#{account_id}/reactivate")
  end

  # Delete an account (use with caution)
  # @param account_id [String] PolarisMail account ID
  def delete_account(account_id)
    delete("/accounts/#{account_id}")
  end

  # ====================
  # MAILBOX MANAGEMENT
  # ====================

  # Create a new mailbox
  # @param account_id [String] PolarisMail account ID
  # @param email [String] Full email address
  # @param display_name [String] Display name
  # @param type [String] Mailbox type: user, shared, resource
  # @param quota_gb [Integer] Storage quota in GB
  # @return [Hash] Mailbox details including ID
  def create_mailbox(account_id:, email:, display_name:, type: "user", quota_gb: 50)
    post("/accounts/#{account_id}/mailboxes", {
      email: email,
      display_name: display_name,
      type: type,
      quota_gb: quota_gb
    })
  end

  # Update mailbox settings
  # @param mailbox_id [String] PolarisMail mailbox ID
  # @param attrs [Hash] Attributes to update
  def update_mailbox(mailbox_id, **attrs)
    patch("/mailboxes/#{mailbox_id}", attrs)
  end

  # Delete a mailbox
  # @param mailbox_id [String] PolarisMail mailbox ID
  def delete_mailbox(mailbox_id)
    delete("/mailboxes/#{mailbox_id}")
  end

  # Get mailbox statistics
  # @param mailbox_id [String] PolarisMail mailbox ID
  # @return [Hash] Storage used, message count, etc.
  def get_mailbox_stats(mailbox_id)
    get("/mailboxes/#{mailbox_id}/stats")
  end

  # List all mailboxes for an account
  # @param account_id [String] PolarisMail account ID
  # @return [Array<Hash>] List of mailboxes
  def list_mailboxes(account_id)
    get("/accounts/#{account_id}/mailboxes")
  end

  # ====================
  # MIGRATION
  # ====================

  # Start a migration from external source
  # @param mailbox_id [String] Target PolarisMail mailbox ID
  # @param source_type [String] Source type: office365, imap, gmail
  # @param source_credentials [Hash] Credentials for source
  # @param options [Hash] Migration options
  # @return [Hash] Migration job details
  def start_migration(mailbox_id:, source_type:, source_credentials:, options: {})
    post("/mailboxes/#{mailbox_id}/migrate", {
      source_type: source_type,
      source_credentials: source_credentials,
      options: {
        include_emails: options.fetch(:include_emails, true),
        include_calendar: options.fetch(:include_calendar, true),
        include_contacts: options.fetch(:include_contacts, true),
        include_folders: options.fetch(:include_folders, true),
        date_range_start: options[:date_range_start],
        date_range_end: options[:date_range_end]
      }.compact
    })
  end

  # Get migration status
  # @param migration_id [String] PolarisMail migration ID
  # @return [Hash] Migration status and progress
  def get_migration_status(migration_id)
    get("/migrations/#{migration_id}")
  end

  # Cancel a running migration
  # @param migration_id [String] PolarisMail migration ID
  def cancel_migration(migration_id)
    post("/migrations/#{migration_id}/cancel")
  end

  # ====================
  # PLANS & PRICING
  # ====================

  # List available plans
  # @return [Array<Hash>] Available plans with pricing
  def list_plans
    get("/plans")
  end

  # Get reseller account info (credits, usage, etc.)
  # @return [Hash] Reseller account details
  def get_reseller_info
    get("/reseller")
  end

  private

  # HTTP request methods with error handling and retries
  def get(path, params = {})
    request(:get, path, params: params)
  end

  def post(path, body = {})
    request(:post, path, json: body)
  end

  def patch(path, body = {})
    request(:patch, path, json: body)
  end

  def delete(path)
    request(:delete, path)
  end

  def request(method, path, retries: 0, **options)
    # Stub implementation - returns mock data for testing
    # TODO: Replace with actual HTTP calls when API is available
    if ENV["POLARIS_API_STUB"] != "false"
      return stub_response(method, path, options)
    end

    response = HTTP
      .auth("Bearer #{@credential.api_key}")
      .headers(
        "X-Reseller-ID" => @credential.reseller_id,
        "Content-Type" => "application/json",
        "Accept" => "application/json"
      )
      .timeout(connect: 5, write: 10, read: 30)
      .public_send(method, "#{API_BASE}#{path}", **options)

    handle_response(response)
  rescue HTTP::TimeoutError => e
    raise ApiError, "Request timed out: #{e.message}"
  rescue HTTP::ConnectionError => e
    if retries < MAX_RETRIES
      sleep(RETRY_DELAY)
      request(method, path, retries: retries + 1, **options)
    else
      raise ApiError, "Connection failed after #{MAX_RETRIES} retries: #{e.message}"
    end
  end

  def handle_response(response)
    case response.status.code
    when 200..299
      response.parse
    when 401
      raise NotConnectedError, "Invalid API credentials"
    when 429
      raise RateLimitError, "Rate limit exceeded"
    when 400..499
      error_body = response.parse rescue {}
      raise ApiError, error_body["error"] || "Client error: #{response.status}"
    when 500..599
      raise ApiError, "Server error: #{response.status}"
    else
      raise ApiError, "Unexpected response: #{response.status}"
    end
  end

  def find_active_credential
    PolarisCredential.connected.first
  end

  def default_plan_id
    ENV.fetch("POLARIS_DEFAULT_PLAN_ID", "reseller_standard")
  end

  # Stub responses for development/testing
  # Remove when real API is integrated
  def stub_response(method, path, _options)
    Rails.logger.info "[PolarisMailService] STUB: #{method.upcase} #{path}"

    case path
    when "/account"
      { "status" => "active", "reseller_id" => @credential.reseller_id }
    when %r{^/accounts$}
      { "id" => "acct_#{SecureRandom.hex(8)}", "domain" => "example.com", "status" => "active" }
    when %r{^/accounts/[\w-]+$}
      { "id" => path.split("/").last, "status" => "active" }
    when %r{^/accounts/[\w-]+/mailboxes$}
      if method == :post
        { "id" => "mbx_#{SecureRandom.hex(8)}", "status" => "active" }
      else
        []
      end
    when %r{^/mailboxes/[\w-]+$}
      { "id" => path.split("/").last, "status" => "active" }
    when %r{^/mailboxes/[\w-]+/migrate$}
      { "id" => "mig_#{SecureRandom.hex(8)}", "status" => "pending" }
    when %r{^/migrations/[\w-]+$}
      { "id" => path.split("/").last, "status" => "completed", "processed_items" => 1000, "total_items" => 1000 }
    when "/plans"
      [
        { "id" => "basic", "name" => "Basic", "price" => 3.00 },
        { "id" => "standard", "name" => "Standard", "price" => 5.00 },
        { "id" => "premium", "name" => "Premium", "price" => 10.00 }
      ]
    when "/reseller"
      { "id" => @credential.reseller_id, "credits" => 1000.00, "accounts" => 0 }
    else
      {}
    end
  end
end
