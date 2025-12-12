# frozen_string_literal: true

# XeroTokenManager - Central service for all Xero OAuth token operations
#
# This is the Single Source of Truth for token management with:
# - Proactive token refresh (15 min before expiry, not after)
# - 30-minute grace period retry (Xero allows retrying same refresh token for 30 min)
# - Failure tracking with retry counters
# - State machine transitions (connected -> degraded -> disconnected)
# - Circuit breaker to stop hammering broken credentials
# - 60-day inactivity detection and prevention
# - Poisoned token detection (burned tokens that will never work again)
#
# Usage:
#   XeroTokenManager.ensure_valid_token(credential)
#   XeroTokenManager.refresh_credential(credential)
#   XeroTokenManager.check_inactive_credentials
#
# Key Insight: Xero refresh tokens are single-use BUT have a 30-minute grace period.
# If the first refresh attempt fails (e.g., DB save fails), we can retry with the
# SAME refresh token for up to 30 minutes. This makes the system much more resilient.
#
class XeroTokenManager
  # Refresh tokens 15 minutes BEFORE they expire (proactive, not reactive)
  # Xero access tokens expire after 30 minutes, so 15 min buffer is ideal
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

  # Xero allows retrying the same refresh token for 30 minutes after first use
  # We retry up to 5 times within this window for DB save failures
  GRACE_PERIOD_RETRIES = 5
  GRACE_PERIOD_DELAY = 2.seconds

  class << self
    # Ensure a credential has a valid token before making API calls
    # Returns true if token is valid (or was successfully refreshed)
    # Returns false if credential is disconnected or refresh failed
    def ensure_valid_token(credential)
      return false unless credential

      # Check if credential is disconnected
      if credential.status == "disconnected"
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
      if credential.circuit_state == "half_open"
        updates[:circuit_state] = "closed"
        Rails.logger.info("[XeroTokenManager] Circuit closed for #{credential.tenant_name} after successful API call")
      end

      # If was degraded, reconnect and trigger sync restart
      if credential.status == "degraded" && credential.refresh_failure_count == 0
        updates[:status] = "connected"
        Rails.logger.info("[XeroTokenManager] Credential #{credential.tenant_name} recovered to connected state")
        auto_resolve_alerts(credential)

        # Trigger sync restart to resume syncing after recovery
        # Do this synchronously since record_api_success is already in a job context
        trigger_sync_restart(reason: "credential_recovery")
      end

      credential.update_columns(updates)
    end

    # Handle a failed API call - increment failure counters, potentially open circuit
    def record_api_failure(credential, error = nil)
      return unless credential

      new_count = credential.circuit_failure_count + 1
      updates = { circuit_failure_count: new_count }

      if new_count >= CIRCUIT_FAILURE_THRESHOLD
        updates[:circuit_state] = "open"
        updates[:circuit_opened_at] = Time.current
        Rails.logger.warn("[XeroTokenManager] Circuit opened for #{credential.tenant_name} after #{new_count} failures")
        create_alert(credential, "rate_limited", "warning", "Too many API failures", error&.message)
      end

      credential.update_columns(updates)
    end

    # Check if credential's circuit breaker is open
    def circuit_open?(credential)
      return false unless credential.circuit_state == "open"

      # Check if enough time has passed to test again
      if credential.circuit_opened_at && credential.circuit_opened_at < CIRCUIT_RESET_TIMEOUT.ago
        # Transition to half-open for testing
        credential.update_columns(circuit_state: "half_open")
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
                              .where("last_successful_api_call_at < ? OR last_successful_api_call_at IS NULL",
                                     INACTIVITY_WARNING_DAYS.days.ago)

      at_risk.find_each do |credential|
        Rails.logger.warn("[XeroTokenManager] Credential #{credential.tenant_name} is at risk of 60-day expiry")

        # Create inactivity warning alert
        create_alert(
          credential,
          "inactivity_warning",
          "warning",
          "Xero connection may expire soon",
          "This Xero connection hasn't been used in over #{INACTIVITY_WARNING_DAYS} days. " \
          "Refresh tokens expire after 60 days of inactivity. Please sync data to keep the connection active."
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
        client.get("Organisation", { tenant_id: credential.tenant_id })
        credential.update_columns(last_successful_api_call_at: Time.current)
        Rails.logger.info("[XeroTokenManager] Touched credential #{credential.tenant_name} to prevent 60-day expiry")
      rescue StandardError => e
        Rails.logger.error("[XeroTokenManager] Failed to touch credential #{credential.tenant_name}: #{e.message}")
      end
    end

    # Get credentials that need proactive refresh (expiring in next 15 minutes)
    def credentials_needing_refresh
      XeroCredential.where(status: %w[connected degraded])
                    .where("expires_at < ?", REFRESH_BUFFER.from_now)
    end

    # Get health summary for all credentials
    # IMPORTANT: Counts by ACTUAL status (token expiry), not just DB status column
    def health_summary
      connected = 0
      degraded = 0
      disconnected = 0

      XeroCredential.all.each do |cred|
        if cred.status == "disconnected" || cred.poisoned?
          disconnected += 1
        elsif cred.status == "connected" && !cred.expired?
          connected += 1
        else
          # status="connected" but expired, OR status="degraded"
          degraded += 1
        end
      end

      {
        total: XeroCredential.count,
        connected: connected,
        degraded: degraded,
        disconnected: disconnected,
        circuit_open: XeroCredential.where(circuit_state: "open").count,
        expiring_soon: credentials_needing_refresh.count,
        at_risk_of_inactivity: XeroCredential.where(status: %w[connected degraded])
                                             .where("last_successful_api_call_at < ?", INACTIVITY_WARNING_DAYS.days.ago)
                                             .count
      }
    end

    # Trigger restart of all Xero sync jobs immediately
    # Call this when reconnecting after a crash/disconnect to resume syncing
    def trigger_sync_restart(reason: "reconnection")
      Rails.logger.info("[XeroTokenManager] Triggering sync restart (reason: #{reason})")

      jobs_triggered = []

      # Queue all sync jobs - they will self-deduplicate via SolidQueue
      begin
        XeroInvoiceSyncJob.perform_later(incremental: true)
        jobs_triggered << "XeroInvoiceSyncJob"
      rescue StandardError => e
        Rails.logger.error("[XeroTokenManager] Failed to queue XeroInvoiceSyncJob: #{e.message}")
      end

      begin
        XeroContactSyncJob.perform_later
        jobs_triggered << "XeroContactSyncJob"
      rescue StandardError => e
        Rails.logger.error("[XeroTokenManager] Failed to queue XeroContactSyncJob: #{e.message}")
      end

      begin
        XeroAttachmentSyncJob.perform_later
        jobs_triggered << "XeroAttachmentSyncJob"
      rescue StandardError => e
        Rails.logger.error("[XeroTokenManager] Failed to queue XeroAttachmentSyncJob: #{e.message}")
      end

      Rails.logger.info("[XeroTokenManager] Sync restart complete. Jobs triggered: #{jobs_triggered.join(', ')}")

      { success: true, jobs_triggered: jobs_triggered, reason: reason }
    end

    private

    def perform_refresh(credential)
      # Check for corrupted credentials
      begin
        access_token = credential.access_token
        original_refresh_token = credential.refresh_token
      rescue ActiveRecord::Encryption::Errors::Decryption => e
        Rails.logger.error("[XeroTokenManager] Decryption failed for #{credential.id}: #{e.message}")
        handle_refresh_failure(credential, e, fatal: true)
        return { success: false, error: "Credentials corrupted" }
      end

      if original_refresh_token.blank?
        handle_refresh_failure(credential, StandardError.new("No refresh token"), fatal: true)
        return { success: false, error: "No refresh token" }
      end

      # Xero has a 30-minute grace period where the SAME refresh token can be retried
      # We leverage this to handle transient DB failures by retrying multiple times
      last_oauth_error = nil
      last_db_error = nil

      GRACE_PERIOD_RETRIES.times do |attempt|
        begin
          client = OAuth2::Client.new(
            ENV["XERO_CLIENT_ID"],
            ENV["XERO_CLIENT_SECRET"],
            site: "https://identity.xero.com",
            token_url: "/connect/token"
          )

          # Always use the ORIGINAL refresh token within the grace period
          # This is safe because Xero allows retrying for 30 minutes
          old_token = OAuth2::AccessToken.new(
            client,
            access_token,
            refresh_token: original_refresh_token
          )

          new_token = old_token.refresh!

          # Store new tokens in memory before DB update
          new_access_token = new_token.token
          new_refresh_token = new_token.refresh_token
          new_expires_at = Time.current + new_token.expires_in.seconds

          # Wrap DB update in transaction
          ActiveRecord::Base.transaction do
            credential.update!(
              access_token: new_access_token,
              refresh_token: new_refresh_token,
              expires_at: new_expires_at,
              refresh_token_expires_at: Time.current + REFRESH_TOKEN_LIFETIME,
              last_refresh_at: Time.current,
              last_refresh_error: nil,
              refresh_failure_count: 0,
              status: "connected",
              token_poisoned_at: nil,
              poisoned_reason: nil
            )
          end

          Rails.logger.info("[XeroTokenManager] Token refreshed for #{credential.tenant_name} (attempt #{attempt + 1})")
          auto_resolve_alerts(credential)

          return { success: true, expires_at: credential.expires_at }

        rescue ActiveRecord::ActiveRecordError => e
          # DB save failed - this is what the grace period helps with!
          # We can safely retry with the same refresh token
          last_db_error = e
          Rails.logger.warn("[XeroTokenManager] DB save failed (attempt #{attempt + 1}/#{GRACE_PERIOD_RETRIES}): #{e.message}")

          if attempt < GRACE_PERIOD_RETRIES - 1
            sleep(GRACE_PERIOD_DELAY)
            next
          end

        rescue OAuth2::Error => e
          last_oauth_error = e
          error_message = e.message.to_s.downcase

          # Check if token is truly poisoned (burned outside grace period)
          if error_message.include?("invalid_grant") ||
             error_message.include?("refresh token has expired") ||
             error_message.include?("refresh token is invalid")

            if attempt > 0
              # We successfully got a new token before but now getting invalid_grant
              # This means grace period expired or consent was revoked
              Rails.logger.error("[XeroTokenManager] Token POISONED for #{credential.tenant_name} after #{attempt + 1} attempts")
              mark_as_poisoned(credential, e)
              return { success: false, error: "Token poisoned - requires re-authentication", poisoned: true }
            else
              # First attempt failed with invalid_grant - token was already bad
              Rails.logger.error("[XeroTokenManager] Token already invalid for #{credential.tenant_name}: #{e.message}")
              mark_as_poisoned(credential, e)
              return { success: false, error: "Token invalid - requires re-authentication", poisoned: true }
            end
          end

          # Other OAuth errors - don't retry, just handle the failure
          handle_refresh_failure(credential, e)
          return { success: false, error: e.message }

        rescue StandardError => e
          # Unexpected error - log and retry
          Rails.logger.error("[XeroTokenManager] Unexpected error (attempt #{attempt + 1}): #{e.message}")
          if attempt < GRACE_PERIOD_RETRIES - 1
            sleep(GRACE_PERIOD_DELAY)
            next
          end
          handle_refresh_failure(credential, e)
          return { success: false, error: e.message }
        end
      end

      # All retries exhausted
      error = last_db_error || last_oauth_error || StandardError.new("All #{GRACE_PERIOD_RETRIES} retry attempts failed")
      Rails.logger.error("[XeroTokenManager] All #{GRACE_PERIOD_RETRIES} refresh attempts failed for #{credential.tenant_name}")
      handle_refresh_failure(credential, error)
      { success: false, error: "Refresh failed after #{GRACE_PERIOD_RETRIES} attempts: #{error.message}" }
    end

    def mark_as_poisoned(credential, error)
      credential.update_columns(
        status: "disconnected",
        token_poisoned_at: Time.current,
        poisoned_reason: error.message.to_s.truncate(255),
        last_refresh_error: "POISONED: #{error.message}"
      )
      create_disconnect_alert(credential, error)
    end

    def handle_refresh_failure(credential, error, fatal: false)
      new_count = credential.refresh_failure_count + 1

      updates = {
        refresh_failure_count: new_count,
        last_refresh_error: error.message.truncate(1000)
      }

      if fatal || new_count >= MAX_REFRESH_ATTEMPTS
        updates[:status] = "disconnected"
        Rails.logger.error("[XeroTokenManager] Credential #{credential.tenant_name} disconnected after #{new_count} failures")
        create_disconnect_alert(credential, error)
      else
        updates[:status] = "degraded"
        Rails.logger.warn("[XeroTokenManager] Credential #{credential.tenant_name} degraded (failure #{new_count}/#{MAX_REFRESH_ATTEMPTS})")
        create_degraded_alert(credential, error)
      end

      credential.update_columns(updates)
    end

    def create_disconnect_alert(credential, error)
      create_alert(
        credential,
        "disconnected",
        "critical",
        "Xero connection disconnected",
        "Your Xero connection to #{credential.tenant_name} has been disconnected. " \
        "Error: #{error.message.truncate(200)}. Please reconnect to continue syncing."
      )
    end

    def create_degraded_alert(credential, error)
      create_alert(
        credential,
        "token_expired",
        "warning",
        "Xero connection issue",
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
