# frozen_string_literal: true

module Microsoft
  # Base client for all Microsoft Graph API clients
  # Handles authentication, HTTP requests, error handling, and rate limiting
  class BaseClient
    GRAPH_API_BASE = MicrosoftGraphBase::GRAPH_API_BASE

    attr_reader :credential

    class NotConnectedError < StandardError; end
    class ApiError < StandardError; end
    class DeadTokenError < NotConnectedError; end

    def initialize(credential)
      @credential = credential
      raise NotConnectedError, "SharePoint not configured. Please configure in Admin > System > Connections." unless @credential

      # Check for dead tokens early - these require re-authentication
      if @credential.respond_to?(:refresh_token_dead?) && @credential.refresh_token_dead?
        reason = @credential.respond_to?(:reconnect_reason) ? @credential.reconnect_reason : "dead token"
        raise DeadTokenError, "SharePoint connection expired (#{reason}). Please reconnect in Admin > System > Connections."
      end

      # FRC (Feb 2026): For credentials with status "error" or expired tokens, try to refresh
      # immediately rather than failing. This ensures 24/7 availability - if a token expired
      # overnight, we can still recover by refreshing on-demand.
      ensure_valid_token! unless @credential.status == "disconnected"
    end

    # SSoT: Reference MicrosoftTokenManager for dead token error codes
    def self.dead_token_error?(error_message)
      MicrosoftTokenManager.dead_token_error?(error_message)
    end

    # Ensure we have a valid token, refreshing if needed
    # FRC (Feb 2026): Called during initialization to recover from overnight token expiry
    def ensure_valid_token!
      return if @credential.valid_credential?

      Rails.logger.info "[#{self.class.name}] Token invalid or expired for #{@credential.name || @credential.id}, attempting refresh..."

      if @credential.app_credential?
        unless @credential.fetch_app_token!
          raise NotConnectedError, "SharePoint token refresh failed. Please check connection in Admin > System > Connections."
        end
      elsif @credential.delegated_credential?
        unless @credential.refresh_delegated_token!
          raise NotConnectedError, "SharePoint token refresh failed. Please reconnect in Admin > System > Connections."
        end
      end

      # Reload to get fresh token data
      @credential.reload
      Rails.logger.info "[#{self.class.name}] Token refreshed successfully for #{@credential.name || @credential.id}"
    rescue StandardError => e
      Rails.logger.error "[#{self.class.name}] Token refresh failed: #{e.message}"
      raise NotConnectedError, "SharePoint connection error: #{e.message}"
    end

    protected

    def access_token
      @credential.valid_access_token
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error "[#{self.class.name}] Token decryption failed: #{e.message}"
      raise NotConnectedError, "SharePoint credentials expired. Please reconnect SharePoint in Admin > System > Connections."
    end

    # Check if error indicates dead token (SSoT: delegates to MicrosoftTokenManager)
    def dead_token_error?(error_message)
      MicrosoftTokenManager.dead_token_error?(error_message)
    end

    # Mark credential as dead
    def mark_credential_dead!(error_message)
      return unless @credential.respond_to?(:mark_dead!)
      @credential.mark_dead!(error_message)
      Rails.logger.error "[#{self.class.name}] Credential marked as dead: #{error_message}"
    end

    # Refresh credential token - supports both old and new models
    def refresh_credential_token!
      if @credential.respond_to?(:fetch_app_token!)
        @credential.fetch_app_token!
      elsif @credential.respond_to?(:fetch_access_token!)
        @credential.fetch_access_token!
      elsif @credential.respond_to?(:valid_access_token)
        @credential.valid_access_token.present?
      else
        false
      end
    end

    # HTTP request helpers

    def get(endpoint, params = {}, include_search: false)
      url = "#{GRAPH_API_BASE}#{endpoint}"
      if params.any?
        url += "?#{URI.encode_www_form(params)}"
        # Add empty search= for SharePoint sites enumeration
        url += "&search=" if include_search && !params.key?("$search")
      elsif include_search
        url += "?search="
      end

      with_retry do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers("Content-Type" => "application/json")
                       .get(url)

        handle_response(response)
      end
    end

    def get_url(full_url)
      with_retry do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers("Content-Type" => "application/json")
                       .get(full_url)

        handle_response(response)
      end
    end

    def post(endpoint, body)
      url = "#{GRAPH_API_BASE}#{endpoint}"

      with_retry do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers("Content-Type" => "application/json")
                       .post(url, json: body)

        handle_response(response)
      end
    end

    def patch(endpoint, body)
      url = "#{GRAPH_API_BASE}#{endpoint}"

      with_retry do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers("Content-Type" => "application/json")
                       .patch(url, json: body)

        handle_response(response)
      end
    end

    def put(endpoint, content, headers = {})
      url = "#{GRAPH_API_BASE}#{endpoint}"

      with_retry do
        response = HTTP.auth("Bearer #{access_token}")
                       .headers(headers)
                       .put(url, body: content)

        handle_response(response)
      end
    end

    def delete(endpoint)
      url = "#{GRAPH_API_BASE}#{endpoint}"

      with_retry do
        response = HTTP.auth("Bearer #{access_token}").delete(url)

        # DELETE returns 204 No Content on success
        return true if response.status.code == 204

        handle_response(response)
      end
    end

    # Retry wrapper for handling token expiration and rate limiting
    # Now includes dead token detection (SSoT migration)
    def with_retry(max_retries: 3, &block)
      attempt = 0

      begin
        attempt += 1
        yield
      rescue ApiError => e
        error_msg = e.message

        # Check for dead token errors first (SSoT - permanent failure)
        if dead_token_error?(error_msg)
          mark_credential_dead!(error_msg)
          raise DeadTokenError, "SharePoint connection permanently failed. Please reconnect in Admin > System > Connections."
        end

        # Extract HTTP status code from error message
        if error_msg.include?("401") || error_msg.include?("Unauthorized")
          # Token expired - refresh and retry
          if attempt <= max_retries
            Rails.logger.info "[#{self.class.name}] Token expired (attempt #{attempt}/#{max_retries}), refreshing..."
            if refresh_credential_token!
              Rails.logger.info "[#{self.class.name}] Token refreshed, retrying request..."
              retry
            else
              # Check if token is now dead after failed refresh
              if @credential.respond_to?(:refresh_token_dead?) && @credential.refresh_token_dead?
                raise DeadTokenError, "SharePoint token refresh failed permanently. Please reconnect."
              end
              Rails.logger.error "[#{self.class.name}] Failed to refresh token"
              raise NotConnectedError, "SharePoint authentication failed. Please reconnect."
            end
          else
            Rails.logger.error "[#{self.class.name}] Max retries exceeded for token refresh"
            raise NotConnectedError, "SharePoint authentication failed after #{max_retries} attempts."
          end
        elsif error_msg.include?("429") || error_msg.include?("Too Many Requests") || error_msg.include?("ApplicationThrottled")
          # Rate limited - use exponential backoff
          # Microsoft Graph API returns 429 with "ApplicationThrottled" for MailboxConcurrency limits
          if attempt <= max_retries
            wait_time = 2 ** attempt  # 2s, 4s, 8s, 16s, 32s
            Rails.logger.warn "[#{self.class.name}] Rate limited (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
            sleep(wait_time)
            retry
          else
            Rails.logger.error "[#{self.class.name}] Max retries exceeded for rate limiting"
            raise ApiError, "Microsoft API rate limit exceeded. Please try again later."
          end
        elsif error_msg.include?("503") || error_msg.include?("Service Unavailable")
          # Service unavailable - retry with backoff
          if attempt <= max_retries
            wait_time = 2 ** attempt
            Rails.logger.warn "[#{self.class.name}] Service unavailable (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
            sleep(wait_time)
            retry
          else
            Rails.logger.error "[#{self.class.name}] Max retries exceeded for service unavailability"
            raise ApiError, "SharePoint service unavailable. Please try again later."
          end
        else
          # Other error - don't retry
          raise
        end
      rescue ActiveRecord::Encryption::Errors::Decryption => e
        Rails.logger.error "[#{self.class.name}] Decryption error during request: #{e.message}"
        raise NotConnectedError, "SharePoint credentials expired. Please reconnect SharePoint."
      end
    end

    def handle_response(response)
      if response.status.success?
        JSON.parse(response.body.to_s)
      else
        error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
        error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
        error_code = response.status.code

        raise ApiError, "#{error_code} - #{error_msg}"
      end
    end
  end
end
