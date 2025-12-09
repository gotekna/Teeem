# frozen_string_literal: true

# XeroTokenManager - Central service for all Xero OAuth token operations
#
# This is the Single Source of Truth for token management with:
# - Proactive token refresh (15 min before expiry, not after)
# - Failure tracking with retry counters
# - State machine transitions (connected -> degraded -> disconnected)
# - Circuit breaker to stop hammering broken credentials
# - 60-day inactivity detection and prevention
#
# Usage:
#   XeroTokenManager.ensure_valid_token(credential)
#   XeroTokenManager.refresh_credential(credential)
#   XeroTokenManager.check_inactive_credentials
#
class XeroTokenManager
  # Refresh tokens 15 minutes BEFORE they expire (proactive, not reactive)
  REFRESH_BUFFER = 15.minutes

  # After 3 consecutive refresh failures, mark credential as disconnected
  MAX_REFRESH_ATTEMPTS = 3

  # Circuit breaker: After 5 API failures, open the circuit
  CIRCUIT_FAILURE_THRESHOLD = 5

  # Circuit breaker: Wait 5 minutes before testing again
  CIRCUIT_RESET_TIMEOUT = 5.minutes

  # Warn users 10 days before refresh token expires from inactivity
  INACTIVITY_WARNING_DAYS = 50

  # Refresh tokens expire after 60 days of inactivity
  REFRESH_TOKEN_LIFETIME = 60.days

  class << self
    # Ensure a credential has a valid token before making API calls
    # Returns true if token is valid (or was successfully refreshed)
    # Returns false if credential is disconnected or refresh failed
    def ensure_valid_token(credential)
      return false unless credential

      # Check if credential is disconnected
      if credential.status == 'disconnected'
        Rails.logger.warn("[XeroTokenManager] Credential #{credential.id} is disconnected, cannot use")
        return false
      end

      # Check circuit breaker
      if circuit_open?(credential)
        Rails.logger.warn("[XeroTokenManager] Circuit is open for credential #{credential.id}, skipping")
        return false
      end

      # Check if token needs refresh
      if needs_refresh?(credential)
        result = refresh_credential(credential)
        return result[:success]
      end

      true
    end

    # Check if a credential's token needs refresh
    def needs_refresh?(credential)
      return true if credential.expires_at.nil?
      credential.expires_at < REFRESH_BUFFER.from_now
    end

    # Refresh a credential's access token
    # Uses advisory lock to prevent concurrent refresh attempts
    def refresh_credential(credential)
      return { success: false, error: "No credential provided" } unless credential

      # Use advisory lock to prevent concurrent refresh attempts
      lock_id = 987654321 + credential.id

      begin
        ActiveRecord::Base.connection.execute("SELECT pg_advisory_lock(#{lock_id})")

        # Reload to check if another process already refreshed
        credential.reload

        # If token was just refreshed, skip
        if credential.expires_at && credential.expires_at > REFRESH_BUFFER.from_now
          Rails.logger.info("[XeroTokenManager] Token for #{credential.tenant_name} was refreshed by another process")
          return { success: true, expires_at: credential.expires_at }
        end

        perform_refresh(credential)
      ensure
        ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(#{lock_id})")
      end
    end

    # Handle a successful API call - reset failure counters
    def record_api_success(credential)
      return unless credential

      updates = {
        last_successful_api_call_at: Time.current,
        circuit_failure_count: 0
      }

      # If circuit was half-open, close it (successful test)
      if credential.circuit_state == 'half_open'
        updates[:circuit_state] = 'closed'
        Rails.logger.info("[XeroTokenManager] Circuit closed for #{credential.tenant_name} after successful API call")
      end

      # If was degraded, reconnect
      if credential.status == 'degraded' && credential.refresh_failure_count == 0
        updates[:status] = 'connected'
        Rails.logger.info("[XeroTokenManager] Credential #{credential.tenant_name} recovered to connected state")
        auto_resolve_alerts(credential)
      end

      credential.update_columns(updates)
    end

    # Handle a failed API call - increment failure counters, potentially open circuit
    def record_api_failure(credential, error = nil)
      return unless credential

      new_count = credential.circuit_failure_count + 1
      updates = { circuit_failure_count: new_count }

      if new_count >= CIRCUIT_FAILURE_THRESHOLD
        updates[:circuit_state] = 'open'
        updates[:circuit_opened_at] = Time.current
        Rails.logger.warn("[XeroTokenManager] Circuit opened for #{credential.tenant_name} after #{new_count} failures")
        create_alert(credential, 'rate_limited', 'warning', 'Too many API failures', error&.message)
      end

      credential.update_columns(updates)
    end

    # Check if credential's circuit breaker is open
    def circuit_open?(credential)
      return false unless credential.circuit_state == 'open'

      # Check if enough time has passed to test again
      if credential.circuit_opened_at && credential.circuit_opened_at < CIRCUIT_RESET_TIMEOUT.ago
        # Transition to half-open for testing
        credential.update_columns(circuit_state: 'half_open')
        Rails.logger.info("[XeroTokenManager] Circuit half-open for #{credential.tenant_name}, will test on next request")
        return false
      end

      true
    end

    # Check for inactive credentials approaching 60-day refresh token expiry
    # Call this periodically (e.g., hourly from XeroHealthMonitorJob)
    def check_inactive_credentials
      # Find credentials that haven't been used in 50+ days
      at_risk = XeroCredential.where(status: %w[connected degraded])
                              .where('last_successful_api_call_at < ? OR last_successful_api_call_at IS NULL',
                                     INACTIVITY_WARNING_DAYS.days.ago)

      at_risk.find_each do |credential|
        Rails.logger.warn("[XeroTokenManager] Credential #{credential.tenant_name} is at risk of 60-day expiry")

        # Create inactivity warning alert
        create_alert(
          credential,
          'inactivity_warning',
          'warning',
          'Xero connection may expire soon',
          "This Xero connection hasn't been used in over #{INACTIVITY_WARNING_DAYS} days. " \
          'Refresh tokens expire after 60 days of inactivity. Please sync data to keep the connection active.'
        )

        # Touch the credential by making a lightweight API call
        touch_credential(credential)
      end
    end

    # Make a lightweight API call to "touch" a credential and reset the 60-day timer
    def touch_credential(credential)
      return unless credential

      begin
        client = XeroApiClient.new
        # Make a simple API call to refresh the token
        client.get('Organisation', { tenant_id: credential.tenant_id })
        credential.update_columns(last_successful_api_call_at: Time.current)
        Rails.logger.info("[XeroTokenManager] Touched credential #{credential.tenant_name} to prevent 60-day expiry")
      rescue StandardError => e
        Rails.logger.error("[XeroTokenManager] Failed to touch credential #{credential.tenant_name}: #{e.message}")
      end
    end

    # Get credentials that need proactive refresh (expiring in next 15 minutes)
    def credentials_needing_refresh
      XeroCredential.where(status: %w[connected degraded])
                    .where('expires_at < ?', REFRESH_BUFFER.from_now)
    end

    # Get health summary for all credentials
    def health_summary
      {
        total: XeroCredential.count,
        connected: XeroCredential.where(status: 'connected').count,
        degraded: XeroCredential.where(status: 'degraded').count,
        disconnected: XeroCredential.where(status: 'disconnected').count,
        circuit_open: XeroCredential.where(circuit_state: 'open').count,
        expiring_soon: credentials_needing_refresh.count,
        at_risk_of_inactivity: XeroCredential.where(status: %w[connected degraded])
                                             .where('last_successful_api_call_at < ?', INACTIVITY_WARNING_DAYS.days.ago)
                                             .count
      }
    end

    private

    def perform_refresh(credential)
      # Check for corrupted credentials
      begin
        access_token = credential.access_token
        refresh_token_value = credential.refresh_token
      rescue ActiveRecord::Encryption::Errors::Decryption => e
        Rails.logger.error("[XeroTokenManager] Decryption failed for #{credential.id}: #{e.message}")
        handle_refresh_failure(credential, e, fatal: true)
        return { success: false, error: "Credentials corrupted" }
      end

      if refresh_token_value.blank?
        handle_refresh_failure(credential, StandardError.new("No refresh token"), fatal: true)
        return { success: false, error: "No refresh token" }
      end

      begin
        client = OAuth2::Client.new(
          ENV['XERO_CLIENT_ID'],
          ENV['XERO_CLIENT_SECRET'],
          site: 'https://identity.xero.com',
          token_url: '/connect/token'
        )

        old_token = OAuth2::AccessToken.new(
          client,
          access_token,
          refresh_token: refresh_token_value
        )

        new_token = old_token.refresh!

        # Update credential with new tokens
        credential.update!(
          access_token: new_token.token,
          refresh_token: new_token.refresh_token,
          expires_at: Time.current + new_token.expires_in.seconds,
          refresh_token_expires_at: Time.current + REFRESH_TOKEN_LIFETIME,
          last_refresh_at: Time.current,
          last_refresh_error: nil,
          refresh_failure_count: 0,
          status: 'connected'
        )

        Rails.logger.info("[XeroTokenManager] Token refreshed for #{credential.tenant_name}")
        auto_resolve_alerts(credential)

        { success: true, expires_at: credential.expires_at }
      rescue OAuth2::Error => e
        handle_refresh_failure(credential, e)
        { success: false, error: e.message }
      rescue StandardError => e
        handle_refresh_failure(credential, e)
        { success: false, error: e.message }
      end
    end

    def handle_refresh_failure(credential, error, fatal: false)
      new_count = credential.refresh_failure_count + 1

      updates = {
        refresh_failure_count: new_count,
        last_refresh_error: error.message.truncate(1000)
      }

      if fatal || new_count >= MAX_REFRESH_ATTEMPTS
        updates[:status] = 'disconnected'
        Rails.logger.error("[XeroTokenManager] Credential #{credential.tenant_name} disconnected after #{new_count} failures")
        create_disconnect_alert(credential, error)
      else
        updates[:status] = 'degraded'
        Rails.logger.warn("[XeroTokenManager] Credential #{credential.tenant_name} degraded (failure #{new_count}/#{MAX_REFRESH_ATTEMPTS})")
        create_degraded_alert(credential, error)
      end

      credential.update_columns(updates)
    end

    def create_disconnect_alert(credential, error)
      create_alert(
        credential,
        'disconnected',
        'critical',
        'Xero connection disconnected',
        "Your Xero connection to #{credential.tenant_name} has been disconnected. " \
        "Error: #{error.message.truncate(200)}. Please reconnect to continue syncing."
      )
    end

    def create_degraded_alert(credential, error)
      create_alert(
        credential,
        'token_expired',
        'warning',
        'Xero connection issue',
        "There was a problem refreshing your Xero connection to #{credential.tenant_name}. " \
        "We'll keep trying. Error: #{error.message.truncate(200)}"
      )
    end

    def create_alert(credential, alert_type, severity, title, message)
      # Find linked company for the alert
      company = find_company_for_credential(credential)

      # Don't create duplicate active alerts
      existing = XeroAlert.where(
        xero_credential: credential,
        alert_type: alert_type,
        dismissed: false,
        auto_resolved: false
      ).first

      return if existing

      XeroAlert.create!(
        xero_credential: credential,
        corporate_company: company,
        alert_type: alert_type,
        severity: severity,
        title: title,
        message: message
      )
    end

    def auto_resolve_alerts(credential)
      XeroAlert.where(xero_credential: credential, dismissed: false, auto_resolved: false)
               .update_all(auto_resolved: true, auto_resolved_at: Time.current)
    end

    def find_company_for_credential(credential)
      # Try to find company via CorporateCompanyXeroConnection
      connection = CorporateCompanyXeroConnection.find_by(xero_credential: credential)
      connection&.corporate_company
    end
  end
end
