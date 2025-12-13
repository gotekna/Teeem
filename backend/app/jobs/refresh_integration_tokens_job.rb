# Proactively refresh OAuth tokens before they expire
# Run this job every 30 minutes via cron/scheduler
class RefreshIntegrationTokensJob < ApplicationJob
  queue_as :default

  def perform
    refresh_user_microsoft_tokens
    refresh_onedrive_tokens
    refresh_xero_tokens
  end

  private

  # Refresh personal Microsoft tokens (for individual users)
  # Only refreshes tokens that are:
  # 1. Connected (status = "connected")
  # 2. Expiring within 15 minutes
  # 3. NOT marked as dead (refresh_token_dead = false)
  def refresh_user_microsoft_tokens
    # Find tokens expiring in the next 15 minutes that are still alive
    UserMicrosoftToken.connected.alive.needs_refresh.find_each do |token|
      Rails.logger.info "[TokenRefresh] Refreshing UserMicrosoftToken for user #{token.user_id} expiring at #{token.token_expires_at}"

      begin
        if token.refresh_access_token!
          token.record_refresh_success!
          Rails.logger.info "[TokenRefresh] UserMicrosoftToken refreshed successfully for user #{token.user_id}"
        else
          # Refresh failed - record failure and check if token is dead
          error_message = token.sync_error || "Unknown refresh error"
          token.record_refresh_failure!(error_message)

          if token.refresh_token_dead?
            Rails.logger.error "[TokenRefresh] UserMicrosoftToken DEAD for user #{token.user_id}: #{error_message}"
          else
            Rails.logger.warn "[TokenRefresh] UserMicrosoftToken refresh failed for user #{token.user_id} (attempt #{token.consecutive_failures}): #{error_message}"
          end
        end
      rescue StandardError => e
        token.record_refresh_failure!(e.message)
        Rails.logger.error "[TokenRefresh] Failed to refresh UserMicrosoftToken for user #{token.user_id}: #{e.message}"
      end
    end

    # Log summary of dead tokens that need user re-auth
    dead_count = UserMicrosoftToken.dead.count
    if dead_count > 0
      Rails.logger.warn "[TokenRefresh] #{dead_count} Microsoft token(s) require user re-authentication"
    end
  end

  def refresh_onedrive_tokens
    # Find credentials expiring in the next 15 minutes
    OrganizationOneDriveCredential.active.each do |credential|
      next unless credential.token_expires_at.present?
      next unless credential.token_expires_at <= 15.minutes.from_now

      Rails.logger.info "[TokenRefresh] Refreshing OneDrive token expiring at #{credential.token_expires_at}"

      begin
        client = MicrosoftGraphClient.new(credential)
        client.refresh_token!
        Rails.logger.info "[TokenRefresh] OneDrive token refreshed successfully, new expiry: #{credential.reload.token_expires_at}"
      rescue StandardError => e
        Rails.logger.error "[TokenRefresh] Failed to refresh OneDrive token: #{e.message}"
      end
    end
  end

  def refresh_xero_tokens
    # Use XeroTokenManager for proactive token refresh
    # Refreshes tokens 15 minutes BEFORE expiry (proactive, not reactive)
    credentials_needing_refresh = XeroTokenManager.credentials_needing_refresh

    if credentials_needing_refresh.none?
      Rails.logger.debug "[TokenRefresh] No Xero tokens need refresh"
      return
    end

    Rails.logger.info "[TokenRefresh] Refreshing #{credentials_needing_refresh.count} Xero tokens"

    credentials_needing_refresh.find_each do |credential|
      Rails.logger.info "[TokenRefresh] Refreshing Xero token for #{credential.tenant_name} (expires: #{credential.expires_at})"

      # Create sync event for tracking
      event = XeroSyncEvent.start!(
        credential: credential,
        sync_type: "token_refresh",
        trigger: "scheduled"
      )

      begin
        result = XeroTokenManager.refresh_credential(credential)

        if result[:success]
          event.complete!(records_processed: 1)
          Rails.logger.info "[TokenRefresh] Xero token refreshed for #{credential.tenant_name}, new expiry: #{result[:expires_at]}"
        else
          event.fail!(error: result[:error])
          Rails.logger.warn "[TokenRefresh] Xero token refresh failed for #{credential.tenant_name}: #{result[:error]}"
        end
      rescue StandardError => e
        event.fail!(error: e.message, error_class: e.class.name)
        Rails.logger.error "[TokenRefresh] Xero token refresh error for #{credential.tenant_name}: #{e.message}"
      end
    end

    # Log health summary after refresh
    summary = XeroTokenManager.health_summary
    Rails.logger.info "[TokenRefresh] Xero health: #{summary[:connected]} connected, #{summary[:degraded]} degraded, #{summary[:disconnected]} disconnected"
  end
end
