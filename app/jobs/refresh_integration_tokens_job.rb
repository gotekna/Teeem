# Proactively refresh OAuth tokens before they expire
# Run this job every 30 minutes via cron/scheduler
class RefreshIntegrationTokensJob < ApplicationJob
  queue_as :default

  def perform
    refresh_onedrive_tokens
    refresh_xero_tokens
  end

  private

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
