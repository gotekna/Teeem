# frozen_string_literal: true

# MicrosoftTokenManager - Central SSoT for all Microsoft OAuth token operations
#
# Based on the proven XeroTokenManager pattern, this service provides:
# - Proactive token refresh (20 min before expiry)
# - PostgreSQL advisory locking (prevents race conditions)
# - Circuit breaker (stops hammering after failures)
# - Dead token detection (AADSTS error codes)
# - Graceful error handling and recovery
#
# Usage:
#   MicrosoftTokenManager.ensure_valid_token(credential)
#   MicrosoftTokenManager.refresh_credential(credential)
#   MicrosoftTokenManager.health_summary
#
# Key difference from Xero: Microsoft refresh tokens are NOT single-use,
# but we still need locking to prevent concurrent refresh attempts that
# could cause race conditions with invalid_grant errors.
#
class MicrosoftTokenManager
  # === SSoT CONSTANTS ===
  # All Microsoft token constants in ONE place

  # Refresh tokens 20 minutes BEFORE they expire (proactive, not reactive)
  # Microsoft access tokens expire after ~60 minutes
  # Buffer MUST be larger than job interval (15 min) to prevent gaps
  REFRESH_BUFFER = 20.minutes

  # After 3 consecutive refresh failures, mark credential as error
  MAX_REFRESH_ATTEMPTS = 3

  # After 5 consecutive failures, mark as dead (circuit breaker)
  CIRCUIT_FAILURE_THRESHOLD = 5

  # AADSTS error codes indicating refresh token is permanently dead
  # Requires user to re-authenticate via OAuth flow
  DEAD_TOKEN_ERROR_CODES = %w[
    AADSTS65001
    AADSTS70000
    AADSTS70008
    AADSTS54005
    invalid_grant
  ].freeze

  # Lock ID offset (different from Xero's 987654321)
  LOCK_ID_OFFSET = 123456789

  class << self
    # Ensure a credential has a valid token before making API calls
    # Returns true if token is valid (or was successfully refreshed)
    # Returns false if credential is dead or refresh failed
    def ensure_valid_token(credential)
      return false unless credential
      return false if credential.refresh_token_dead?

      # Check if token needs refresh
      if needs_refresh?(credential)
        result = refresh_credential(credential)
        return result[:success]
      end

      true
    end

    # Check if a credential's token needs refresh
    def needs_refresh?(credential)
      return true if credential.token_expires_at.nil?
      credential.token_expires_at < REFRESH_BUFFER.from_now
    end

    # Refresh a credential's access token
    # Uses advisory lock to prevent concurrent refresh attempts (fixes race condition bug)
    def refresh_credential(credential)
      return { success: false, error: "No credential provided" } unless credential
      return { success: false, error: "Credential is dead" } if credential.refresh_token_dead?

      # Use advisory lock to prevent concurrent refresh attempts
      lock_id = LOCK_ID_OFFSET + credential.id

      begin
        ActiveRecord::Base.connection.execute("SELECT pg_advisory_lock(#{lock_id})")

        # Reload to check if another process already refreshed
        credential.reload

        # If token was just refreshed by another process, skip
        if credential.token_expires_at && credential.token_expires_at > REFRESH_BUFFER.from_now
          Rails.logger.info("[MicrosoftTokenManager] Token for #{credential_name(credential)} was refreshed by another process")
          return { success: true, expires_at: credential.token_expires_at }
        end

        perform_refresh(credential)
      ensure
        ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(#{lock_id})")
      end
    end

    # Handle a successful API call - reset failure counters
    def record_api_success(credential)
      return unless credential

      credential.update_columns(
        consecutive_failures: 0,
        error_message: nil,
        error_code: nil
      )
    end

    # Handle a failed API call - increment failure counters
    def record_api_failure(credential, error_message)
      return unless credential

      new_count = (credential.consecutive_failures || 0) + 1

      if dead_token_error?(error_message)
        mark_dead!(credential, error_message)
      elsif new_count >= CIRCUIT_FAILURE_THRESHOLD
        # Circuit breaker: too many consecutive failures
        mark_dead!(credential, "Circuit breaker: #{new_count} consecutive failures. Last error: #{error_message}")
      else
        credential.update_columns(
          consecutive_failures: new_count,
          error_message: error_message,
          last_error_at: Time.current,
          status: "error"
        )
      end
    end

    # Check if error message indicates a dead token
    def dead_token_error?(error_message)
      return false if error_message.blank?
      DEAD_TOKEN_ERROR_CODES.any? { |code| error_message.to_s.upcase.include?(code.upcase) }
    end

    # Get health summary for all Microsoft credentials
    def health_summary
      connected = 0
      error = 0
      dead = 0

      MicrosoftCredential.active.find_each do |cred|
        case cred.status
        when "connected"
          if cred.token_expires_at && cred.token_expires_at > REFRESH_BUFFER.from_now
            connected += 1
          else
            error += 1 # Token expired = effectively in error state
          end
        when "error"
          error += 1
        when "dead", "disconnected"
          dead += 1
        else
          error += 1
        end
      end

      {
        total: MicrosoftCredential.active.count,
        connected: connected,
        error: error,
        dead: dead,
        needs_refresh: MicrosoftCredential.connected.alive.needs_refresh.count
      }
    end

    # Get all credentials that need refresh (for job to process)
    def credentials_needing_refresh
      MicrosoftCredential.connected.alive.needs_refresh
    end

    private

    def perform_refresh(credential)
      if credential.app_credential?
        perform_app_refresh(credential)
      else
        perform_delegated_refresh(credential)
      end
    end

    # App credentials use client credentials flow (no user interaction)
    def perform_app_refresh(credential)
      response = HTTP.post(
        "https://login.microsoftonline.com/#{credential.tenant_id}/oauth2/v2.0/token",
        form: {
          client_id: credential.client_id,
          client_secret: credential.client_secret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials"
        }
      )

      if response.status.success?
        data = response.parse
        credential.update!(
          access_token: data["access_token"],
          token_expires_at: Time.current + data["expires_in"].to_i.seconds,
          status: "connected",
          error_code: nil,
          error_message: nil,
          consecutive_failures: 0,
          last_refresh_attempt_at: Time.current
        )
        Rails.logger.info("[MicrosoftTokenManager] App token refreshed for #{credential_name(credential)}")
        { success: true, expires_at: credential.token_expires_at }
      else
        error_msg = extract_error_message(response)
        handle_refresh_failure(credential, error_msg)
        { success: false, error: error_msg }
      end
    rescue StandardError => e
      handle_refresh_failure(credential, e.message)
      { success: false, error: e.message }
    end

    # Delegated credentials use refresh token flow
    def perform_delegated_refresh(credential)
      return { success: false, error: "No refresh token" } if credential.refresh_token.blank?

      response = HTTP.post(
        "https://login.microsoftonline.com/#{credential.tenant_id.presence || 'common'}/oauth2/v2.0/token",
        form: {
          client_id: ENV["OUTLOOK_CLIENT_ID"],
          client_secret: ENV["OUTLOOK_CLIENT_SECRET"],
          refresh_token: credential.refresh_token,
          grant_type: "refresh_token",
          scope: credential.scopes.presence || MicrosoftCredential::REQUIRED_SCOPES.join(" ")
        }
      )

      if response.status.success?
        data = response.parse
        credential.update!(
          access_token: data["access_token"],
          refresh_token: data["refresh_token"] || credential.refresh_token,
          token_expires_at: Time.current + data["expires_in"].to_i.seconds,
          scopes: data["scope"],
          status: "connected",
          error_code: nil,
          error_message: nil,
          consecutive_failures: 0,
          refresh_token_dead: false,
          last_refresh_attempt_at: Time.current
        )
        Rails.logger.info("[MicrosoftTokenManager] Delegated token refreshed for #{credential_name(credential)}")
        { success: true, expires_at: credential.token_expires_at }
      else
        error_msg = extract_error_message(response)
        handle_refresh_failure(credential, error_msg)
        { success: false, error: error_msg }
      end
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      # Corrupted token - mark as dead
      Rails.logger.error("[MicrosoftTokenManager] Decryption failed for #{credential.id}: #{e.message}")
      mark_dead!(credential, "Token decryption failed - reconnection required")
      { success: false, error: "Credentials corrupted" }
    rescue StandardError => e
      handle_refresh_failure(credential, e.message)
      { success: false, error: e.message }
    end

    # Extract error message from HTTP response, preserving AADSTS codes
    def extract_error_message(response)
      body = response.body.to_s

      # Try JSON parse first
      begin
        data = JSON.parse(body)
        return data["error_description"] || data["error"] || "Unknown error"
      rescue JSON::ParserError
        # Fall through
      end

      # Extract AADSTS code from raw body
      if body =~ /(AADSTS\d+)/
        return $1
      end

      # Fallback
      "Token refresh failed: #{response.status}"
    end

    def handle_refresh_failure(credential, error_message)
      new_count = (credential.consecutive_failures || 0) + 1

      if dead_token_error?(error_message)
        mark_dead!(credential, error_message)
      elsif new_count >= CIRCUIT_FAILURE_THRESHOLD
        # Circuit breaker triggered
        mark_dead!(credential, "Circuit breaker: #{new_count} failures. Last: #{error_message}")
      elsif new_count >= MAX_REFRESH_ATTEMPTS
        # Max attempts reached - mark as error but not dead yet
        credential.update_columns(
          consecutive_failures: new_count,
          error_message: error_message,
          last_error_at: Time.current,
          last_refresh_attempt_at: Time.current,
          status: "error"
        )
        Rails.logger.warn("[MicrosoftTokenManager] #{credential_name(credential)} in error state (failure #{new_count}/#{CIRCUIT_FAILURE_THRESHOLD})")
      else
        # Transient failure - increment counter but keep trying
        credential.update_columns(
          consecutive_failures: new_count,
          error_message: error_message,
          last_error_at: Time.current,
          last_refresh_attempt_at: Time.current
        )
        Rails.logger.warn("[MicrosoftTokenManager] Transient failure for #{credential_name(credential)} (#{new_count}/#{MAX_REFRESH_ATTEMPTS})")
      end
    end

    def mark_dead!(credential, error_message)
      credential.update_columns(
        refresh_token_dead: true,
        status: "dead",
        error_code: extract_error_code(error_message),
        error_message: error_message,
        last_error_at: Time.current,
        last_refresh_attempt_at: Time.current
      )
      Rails.logger.error("[MicrosoftTokenManager] Marked as DEAD: #{credential_name(credential)} - #{error_message}")
    end

    def extract_error_code(error_message)
      return nil if error_message.blank?
      DEAD_TOKEN_ERROR_CODES.find { |code| error_message.to_s.upcase.include?(code.upcase) }
    end

    def credential_name(credential)
      if credential.owner_type.present?
        "#{credential.credential_type}/#{credential.owner_type}##{credential.owner_id}"
      else
        "#{credential.credential_type}/#{credential.name || credential.id}"
      end
    end
  end
end
