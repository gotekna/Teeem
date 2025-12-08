# EmailSharePointSyncJob - Sync emails to SharePoint storage
#
# This job runs periodically to sync pending emails to SharePoint.
# It stores email content as .eml files in SharePoint, organized by:
#   @domain/user@domain/year/month/date - subject.eml
#
# Usage:
#   EmailSharePointSyncJob.perform_later                    # Default: 50 emails
#   EmailSharePointSyncJob.perform_later(limit: 100)        # Custom limit
#   EmailSharePointSyncJob.perform_later(domain: "tekna.com.au")  # Specific domain
#
class EmailSharePointSyncJob < ApplicationJob
  queue_as :low

  # Rate limit to avoid overwhelming SharePoint API
  BATCH_SIZE = 50
  DELAY_BETWEEN_BATCHES = 2.seconds

  def perform(limit: BATCH_SIZE, domain: nil, user_email: nil)
    service = EmailSharePointService.new

    results = if user_email.present?
      Rails.logger.info "[EmailSharePointSync] Syncing emails for user: #{user_email}"
      service.sync_user(user_email, limit: limit)
    elsif domain.present?
      Rails.logger.info "[EmailSharePointSync] Syncing emails for domain: #{domain}"
      service.sync_domain(domain, limit: limit)
    else
      Rails.logger.info "[EmailSharePointSync] Syncing all pending emails (limit: #{limit})"
      service.sync_all_pending(limit: limit, only_business: true)
    end

    Rails.logger.info "[EmailSharePointSync] Complete - Processed: #{results[:processed]}, Uploaded: #{results[:uploaded]}"

    if results[:errors].any?
      Rails.logger.warn "[EmailSharePointSync] Errors: #{results[:errors].count}"
      results[:errors].first(5).each do |error|
        Rails.logger.error "[EmailSharePointSync] Email #{error[:email_id]}: #{error[:error]}"
      end
    end

    results
  rescue MicrosoftAppGraphClient::NotConnectedError => e
    Rails.logger.warn "[EmailSharePointSync] Microsoft Graph not connected: #{e.message}"
    { processed: 0, uploaded: 0, skipped: 0, errors: [{ error: e.message }] }
  rescue EmailSharePointService::NotConnectedError => e
    Rails.logger.warn "[EmailSharePointSync] SharePoint not configured: #{e.message}"
    { processed: 0, uploaded: 0, skipped: 0, errors: [{ error: e.message }] }
  end

  # Class method for quick one-off sync
  def self.sync_now(limit: 50)
    new.perform(limit: limit)
  end
end
