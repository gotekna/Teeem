# frozen_string_literal: true

# PolarisMailService - API client for PolarisMail/EmailArray reseller integration
#
# API discovered via reverse-engineering the admin panel:
# - Endpoint: https://cfcp.emailarray.com/admin/json.php
# - Auth: Session-based (username/password login, CSRF token per request)
#
# Usage:
#   service = PolarisMailService.new
#   service.create_mailbox(
#     domain: "example.com",
#     username: "john",
#     password: "SecurePass123!",
#     display_name: "John Doe"
#   )
#
class PolarisMailService
  class ApiError < StandardError; end
  class AuthenticationError < StandardError; end
  class NotConnectedError < StandardError; end
  class RateLimitError < StandardError; end

  # PolarisMail Admin API endpoint
  API_BASE = "https://cfcp.emailarray.com/admin"

  # Account types
  ACCOUNT_TYPES = {
    basic: 1,
    enhanced: 2
  }.freeze

  def initialize(credential = nil)
    @credential = credential || find_active_credential
    @session_cookie = nil
    @csrf_token = nil
  end

  # ====================
  # CONNECTION
  # ====================

  # Test connection by attempting login
  def test_connection
    authenticate!
    true
  rescue AuthenticationError, ApiError => e
    Rails.logger.warn "[PolarisMailService] Connection test failed: #{e.message}"
    false
  end

  # ====================
  # MAILBOX MANAGEMENT
  # ====================

  # Create a new mailbox
  # @param domain [String] Domain name (e.g., "100xbestlife.com")
  # @param username [String] Local part of email (e.g., "john")
  # @param password [String] Mailbox password
  # @param display_name [String] Display name
  # @param quota_gb [Integer] Storage quota in GB (default 5)
  # @param account_type [Symbol] :basic or :enhanced
  # @return [Hash] Response from API
  def create_mailbox(domain:, username:, password:, display_name:, quota_gb: 5, account_type: :basic)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "addUser",
      token: @csrf_token,
      domain: domain,
      username: username,
      password: password,
      uname: display_name,
      quota: quota_gb,
      account_type: ACCOUNT_TYPES[account_type] || 1,
      twofa_allowed: 1,
      user_language: "en",
      timezone: "Australia/Brisbane",
      dateformat: "dd-mm-yyyy"
    })

    handle_response(response, "create_mailbox")
  end

  # Delete a mailbox
  # @param domain [String] Domain name
  # @param username [String] Local part of email
  def delete_mailbox(domain:, username:)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "deleteUser",
      token: @csrf_token,
      domain: domain,
      username: username
    })

    handle_response(response, "delete_mailbox")
  end

  # Update mailbox quota
  # @param domain [String] Domain name
  # @param username [String] Local part of email
  # @param quota_gb [Integer] New quota in GB
  def update_mailbox_quota(domain:, username:, quota_gb:)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "updateUser",
      token: @csrf_token,
      domain: domain,
      username: username,
      quota: quota_gb
    })

    handle_response(response, "update_mailbox_quota")
  end

  # Reset mailbox password
  # @param domain [String] Domain name
  # @param username [String] Local part of email
  # @param new_password [String] New password
  def reset_password(domain:, username:, new_password:)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "updatePassword",
      token: @csrf_token,
      domain: domain,
      username: username,
      password: new_password
    })

    handle_response(response, "reset_password")
  end

  # List all mailboxes for a domain
  # @param domain [String] Domain name
  # @return [Array<Hash>] List of mailboxes
  def list_mailboxes(domain:)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "getUsers",
      token: @csrf_token,
      domain: domain
    })

    handle_response(response, "list_mailboxes")
  end

  # ====================
  # DOMAIN MANAGEMENT
  # ====================

  # Add a domain
  # @param domain [String] Domain name
  def add_domain(domain:)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "addDomain",
      token: @csrf_token,
      domain: domain
    })

    handle_response(response, "add_domain")
  end

  # List all domains
  # @return [Array<Hash>] List of domains
  def list_domains
    ensure_authenticated!

    response = post_form("json.php", {
      action: "getDomains",
      token: @csrf_token
    })

    handle_response(response, "list_domains")
  end

  # Get domain health status
  # @param domain [String] Domain name
  # @return [Hash] Domain health info
  def domain_health(domain:)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "getDomainHealth",
      token: @csrf_token,
      domain: domain
    })

    handle_response(response, "domain_health")
  end

  # ====================
  # ALIASES
  # ====================

  # Add an alias
  # @param domain [String] Domain name
  # @param alias_address [String] Alias local part
  # @param target_address [String] Target email address
  def add_alias(domain:, alias_address:, target_address:)
    ensure_authenticated!

    response = post_form("json.php", {
      action: "addAlias",
      token: @csrf_token,
      domain: domain,
      alias: alias_address,
      target: target_address
    })

    handle_response(response, "add_alias")
  end

  private

  # Authenticate with PolarisMail admin panel
  def authenticate!
    raise NotConnectedError, "PolarisMail not configured" unless @credential

    # Login request
    response = HTTP
      .timeout(connect: 5, write: 10, read: 30)
      .post("#{API_BASE}/json.php", form: {
        action: "login",
        username: @credential.admin_username,
        password: @credential.admin_password
      })

    unless response.status.success?
      raise AuthenticationError, "Login failed: #{response.status}"
    end

    # Extract session cookie
    set_cookie = response.headers["Set-Cookie"]
    if set_cookie && set_cookie.include?("PHPSESSID")
      @session_cookie = set_cookie.match(/PHPSESSID=([^;]+)/)[1]
    else
      raise AuthenticationError, "No session cookie received"
    end

    # Parse response for token
    # API returns: {"returncode":1,"returndata":"<csrf_token>"}
    body = response.parse rescue {}
    if body["returncode"] == 1 && body["returndata"]
      @csrf_token = body["returndata"]
    else
      raise AuthenticationError, "Login failed: #{body['returndata'] || 'Unknown error'}"
    end

    Rails.logger.info "[PolarisMailService] Authenticated successfully"
    true
  end

  def ensure_authenticated!
    authenticate! unless @session_cookie && @csrf_token
  end

  def post_form(path, params)
    HTTP
      .cookies(PHPSESSID: @session_cookie)
      .timeout(connect: 5, write: 10, read: 30)
      .post("#{API_BASE}/#{path}", form: params)
  end

  def handle_response(response, operation)
    unless response.status.success?
      raise ApiError, "#{operation} failed: HTTP #{response.status}"
    end

    body = response.parse rescue {}

    # API returns: {"returncode":1,"returndata":...} for success
    # API returns: {"returncode":0,"returndata":"error message"} for failure
    if body.is_a?(Hash)
      if body["returncode"] == 0
        raise ApiError, "#{operation} failed: #{body['returndata'] || 'Unknown error'}"
      end

      # Re-authenticate if session expired
      if body["returndata"].is_a?(String) && body["returndata"].include?("session")
        @session_cookie = nil
        @csrf_token = nil
        raise AuthenticationError, "Session expired"
      end
    end

    body["returndata"] || body
  rescue JSON::ParserError
    raise ApiError, "#{operation} failed: Invalid JSON response"
  end

  def find_active_credential
    PolarisCredential.connected.first
  end
end
