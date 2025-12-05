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
  def refresh_user_microsoft_tokens
    # Find tokens expiring in the next 15 minutes
    UserMicrosoftToken.connected.needs_refresh.find_each do |token|
      Rails.logger.info "[TokenRefresh] Refreshing UserMicrosoftToken for user #{token.user_id} expiring at #{token.token_expires_at}"

      begin
        if token.refresh_access_token!
          Rails.logger.info "[TokenRefresh] UserMicrosoftToken refreshed successfully for user #{token.user_id}"
        else
          Rails.logger.warn "[TokenRefresh] UserMicrosoftToken refresh failed for user #{token.user_id}: #{token.sync_error}"
        end
      rescue StandardError => e
        Rails.logger.error "[TokenRefresh] Failed to refresh UserMicrosoftToken for user #{token.user_id}: #{e.message}"
      end
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
    # Find credentials expiring in the next 15 minutes
    XeroCredential.all.each do |credential|
      next unless credential.expires_at.present?
      next unless credential.expired?

      Rails.logger.info "[TokenRefresh] Refreshing Xero token expiring at #{credential.expires_at}"

      begin
        service = XeroAuthService.new
        service.refresh_access_token(credential)
        Rails.logger.info "[TokenRefresh] Xero token refreshed successfully"
      rescue StandardError => e
        Rails.logger.error "[TokenRefresh] Failed to refresh Xero token: #{e.message}"
      end
    end
  end
end
