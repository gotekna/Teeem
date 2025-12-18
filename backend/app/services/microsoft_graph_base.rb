# frozen_string_literal: true

# MicrosoftGraphBase - Shared base class for all Microsoft Graph API clients
#
# Provides:
# - Unified HTTP methods (get, post, put, patch, delete)
# - Retry logic with dead token detection
# - Decryption error handling
# - Exponential backoff for rate limits
# - Consistent error responses
#
# Subclasses:
# - MicrosoftAppGraphClient (application permissions)
# - MicrosoftGraphClient (delegated permissions)
#
class MicrosoftGraphBase
  GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

  class AuthenticationError < StandardError; end
  class DeadTokenError < AuthenticationError; end
  class ApiError < StandardError; end
  class NotConnectedError < StandardError; end

  # AADSTS error codes indicating refresh token is permanently dead
  # Matches MicrosoftCredential::DEAD_TOKEN_ERROR_CODES
  DEAD_TOKEN_ERROR_CODES = %w[
    AADSTS65001
    AADSTS70000
    AADSTS70008
    AADSTS54005
    invalid_grant
  ].freeze

  attr_reader :credential

  def initialize(credential)
    @credential = credential
    validate_credential!
  end

  protected

  # Get access token, handling decryption errors
  def access_token
    @credential.valid_access_token
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[#{log_prefix}] Token decryption failed: #{e.message}"
    raise AuthenticationError, "SharePoint credentials expired. Please reconnect SharePoint in Admin > System > Connections."
  end

  # HTTP GET
  def get(endpoint, params = {}, include_search: false)
    url = build_url(endpoint, params, include_search)

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .get(url)
      handle_response(response)
    end
  end

  # GET with full URL (for pagination links)
  def get_url(full_url)
    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .get(full_url)
      handle_response(response)
    end
  end

  # HTTP POST (JSON body)
  def post(endpoint, body)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .post(url, json: body)
      handle_response(response)
    end
  end

  # HTTP PUT (raw body with custom headers)
  def put(endpoint, content, headers = {})
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers(headers)
                     .put(url, body: content)
      handle_response(response)
    end
  end

  # HTTP PATCH
  def patch(endpoint, body)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .patch(url, json: body)
      handle_response(response)
    end
  end

  # HTTP DELETE
  def delete(endpoint)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .delete(url)
      handle_response(response, allow_no_content: true)
    end
  end

  private

  def validate_credential!
    raise NotConnectedError, "No credential provided" unless @credential

    if @credential.respond_to?(:refresh_token_dead?) && @credential.refresh_token_dead?
      reason = @credential.respond_to?(:reconnect_reason) ? @credential.reconnect_reason : "dead token"
      raise DeadTokenError, "SharePoint connection expired (#{reason}). Please reconnect in Admin > System > Connections."
    end

    unless @credential.status == "connected"
      raise NotConnectedError, "SharePoint not connected. Please connect in Admin > System > Connections."
    end
  end

  def build_url(endpoint, params, include_search = false)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    if params.any?
      url += "?#{URI.encode_www_form(params)}"
      # Add empty search= for SharePoint sites enumeration
      url += "&search=" if include_search && !params.key?("$search")
    elsif include_search
      url += "?search="
    end

    url
  end

  def with_retry(max_retries: 3)
    attempt = 0

    begin
      attempt += 1
      yield
    rescue ApiError => e
      handle_retry_error(e, attempt, max_retries)
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error "[#{log_prefix}] Decryption error during request: #{e.message}"
      raise AuthenticationError, "SharePoint credentials expired. Please reconnect SharePoint."
    end
  end

  def handle_retry_error(error, attempt, max_retries)
    error_msg = error.message

    # Check for dead token errors first
    if dead_token_error?(error_msg)
      mark_credential_dead!(error_msg)
      raise DeadTokenError, "SharePoint connection permanently failed. Please reconnect in Admin > System > Connections."
    end

    # Token expired - refresh and retry
    if error_msg.include?("401") || error_msg.include?("Unauthorized")
      handle_auth_retry(attempt, max_retries)

    # Rate limited - exponential backoff
    elsif error_msg.include?("429") || error_msg.include?("Too Many Requests")
      handle_rate_limit_retry(attempt, max_retries)

    # Service unavailable - exponential backoff
    elsif error_msg.include?("503") || error_msg.include?("Service Unavailable")
      handle_service_unavailable_retry(attempt, max_retries)

    else
      # Other error - don't retry
      raise
    end
  end

  def handle_auth_retry(attempt, max_retries)
    if attempt <= max_retries
      Rails.logger.info "[#{log_prefix}] Token expired (attempt #{attempt}/#{max_retries}), refreshing..."

      if refresh_credential_token!
        Rails.logger.info "[#{log_prefix}] Token refreshed, retrying request..."
        retry
      else
        # Check if token is now dead after failed refresh
        if @credential.respond_to?(:refresh_token_dead?) && @credential.refresh_token_dead?
          raise DeadTokenError, "SharePoint token refresh failed permanently. Please reconnect."
        end
        Rails.logger.error "[#{log_prefix}] Failed to refresh token"
        raise AuthenticationError, "SharePoint authentication failed. Please reconnect."
      end
    else
      Rails.logger.error "[#{log_prefix}] Max retries exceeded for token refresh"
      raise AuthenticationError, "SharePoint authentication failed after #{max_retries} attempts."
    end
  end

  def handle_rate_limit_retry(attempt, max_retries)
    if attempt <= max_retries
      wait_time = 2 ** attempt  # 2s, 4s, 8s
      Rails.logger.warn "[#{log_prefix}] Rate limited (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
      sleep(wait_time)
      retry
    else
      Rails.logger.error "[#{log_prefix}] Max retries exceeded for rate limiting"
      raise ApiError, "SharePoint API rate limit exceeded. Please try again later."
    end
  end

  def handle_service_unavailable_retry(attempt, max_retries)
    if attempt <= max_retries
      wait_time = 2 ** attempt
      Rails.logger.warn "[#{log_prefix}] Service unavailable (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
      sleep(wait_time)
      retry
    else
      Rails.logger.error "[#{log_prefix}] Max retries exceeded for service unavailability"
      raise ApiError, "SharePoint service unavailable. Please try again later."
    end
  end

  def dead_token_error?(error_message)
    return false if error_message.blank?
    DEAD_TOKEN_ERROR_CODES.any? { |code| error_message.to_s.include?(code) }
  end

  def mark_credential_dead!(error_message)
    return unless @credential.respond_to?(:mark_dead!)
    @credential.mark_dead!(error_message)
    Rails.logger.error "[#{log_prefix}] Credential marked as dead: #{error_message}"
  end

  def refresh_credential_token!
    if @credential.respond_to?(:fetch_app_token!)
      @credential.fetch_app_token!
    elsif @credential.respond_to?(:refresh_delegated_token!)
      @credential.refresh_delegated_token!
    elsif @credential.respond_to?(:valid_access_token)
      @credential.valid_access_token.present?
    else
      false
    end
  end

  def handle_response(response, allow_no_content: false)
    case response.status.code
    when 200, 201
      JSON.parse(response.body.to_s)
    when 204
      allow_no_content ? true : {}
    else
      error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
      error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
      error_code = response.status.code

      raise ApiError, "#{error_code} - #{error_msg}"
    end
  end

  def log_prefix
    self.class.name.gsub(/Client$/, "")
  end

  # Utility: Format drive item for consistent output
  def format_drive_item(item)
    {
      id: item["id"],
      name: item["name"],
      size: item["size"],
      created_at: item["createdDateTime"],
      modified_at: item["lastModifiedDateTime"],
      web_url: item["webUrl"],
      is_folder: item["folder"].present?,
      child_count: item.dig("folder", "childCount"),
      mime_type: item.dig("file", "mimeType"),
      download_url: item["@microsoft.graph.downloadUrl"],
      parent_drive_id: item.dig("parentReference", "driveId"),
      parent_path: item.dig("parentReference", "path")
    }
  end
end
