# Proactively refresh OAuth tokens before they expire
# Run this job every 30 minutes via cron/scheduler
class RefreshIntegrationTokensJob < ApplicationJob
  queue_as :default

  def perform
    refresh_user_microsoft_tokens
    refresh_user_outlook_tokens  # SSoT fix: was missing, caused Rachel's token to expire
    refresh_onedrive_tokens
    refresh_xero_tokens

    # DUAL-WRITE: Also refresh tokens in unified MicrosoftCredential table (SSoT migration)
    refresh_unified_microsoft_credentials
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

  # Refresh UserOutlookCredential tokens (for Outlook email access)
  # SSoT fix: This was missing, causing tokens like Rachel's to expire without auto-refresh
  # Ultra thinking: Proactive refresh 1 HOUR before expiry, not reactive 20 minutes
  def refresh_user_outlook_tokens
    # Proactively refresh tokens expiring in the next HOUR
    # This gives 4x buffer vs 15-min job interval - tokens never get close to expiring
    UserOutlookCredential.where("expires_at <= ?", 1.hour.from_now).find_each do |credential|
      Rails.logger.info "[TokenRefresh] Refreshing UserOutlookCredential for #{credential.email || credential.user_id} expiring at #{credential.expires_at}"

      begin
        if credential.refresh!
          Rails.logger.info "[TokenRefresh] UserOutlookCredential refreshed successfully for #{credential.email || credential.user_id}"
        else
          Rails.logger.warn "[TokenRefresh] UserOutlookCredential refresh failed for #{credential.email || credential.user_id}"
        end
      rescue StandardError => e
        Rails.logger.error "[TokenRefresh] Failed to refresh UserOutlookCredential for #{credential.email || credential.user_id}: #{e.message}"
      end
    end
  end

  def refresh_onedrive_tokens
    # Proactively refresh tokens expiring in the next HOUR
    # Ultra thinking: 4x buffer vs 15-min job interval - tokens never get close to expiring
    OrganizationOneDriveCredential.active.each do |credential|
      next unless credential.token_expires_at.present?
      next unless credential.token_expires_at <= 1.hour.from_now

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

  # DUAL-WRITE: Refresh tokens in unified MicrosoftCredential table
  # This is part of SSoT migration - eventually becomes the ONLY refresh logic
  def refresh_unified_microsoft_credentials
    # Skip if MicrosoftCredential table doesn't exist yet (migration not run)
    unless ActiveRecord::Base.connection.table_exists?(:microsoft_credentials)
      Rails.logger.debug "[TokenRefresh] MicrosoftCredential table not yet created, skipping"
      return
    end

    # Refresh all credentials that need refresh and are not dead
    MicrosoftCredential.connected.alive.needs_refresh.find_each do |credential|
      Rails.logger.info "[TokenRefresh] Refreshing MicrosoftCredential #{credential.id} (#{credential.credential_type}) expiring at #{credential.token_expires_at}"

      begin
        if credential.app_credential?
          # App credentials use client credentials flow
          if credential.fetch_app_token!
            Rails.logger.info "[TokenRefresh] MicrosoftCredential (app) #{credential.id} refreshed successfully"
          else
            Rails.logger.warn "[TokenRefresh] MicrosoftCredential (app) #{credential.id} refresh failed: #{credential.error_message}"
          end
        else
          # Delegated credentials use refresh token flow
          if credential.refresh_delegated_token!
            Rails.logger.info "[TokenRefresh] MicrosoftCredential (delegated) #{credential.id} refreshed successfully"
          else
            if credential.refresh_token_dead?
              Rails.logger.error "[TokenRefresh] MicrosoftCredential #{credential.id} DEAD: #{credential.error_message}"
            else
              Rails.logger.warn "[TokenRefresh] MicrosoftCredential #{credential.id} refresh failed: #{credential.error_message}"
            end
          end
        end
      rescue StandardError => e
        credential.record_refresh_failure!(e.message)
        Rails.logger.error "[TokenRefresh] MicrosoftCredential #{credential.id} error: #{e.message}"
      end
    end

    # Log summary
    total = MicrosoftCredential.count
    connected = MicrosoftCredential.connected.count
    dead = MicrosoftCredential.dead.count
    Rails.logger.info "[TokenRefresh] MicrosoftCredential health: #{connected}/#{total} connected, #{dead} dead" if total > 0
  end
end
