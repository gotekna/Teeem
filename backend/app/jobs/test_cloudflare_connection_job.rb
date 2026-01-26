# frozen_string_literal: true

# TestCloudflareConnectionJob - Tests Cloudflare API connection in background
#
# Called when Cloudflare credentials are created or updated to verify
# the API token works correctly.
#
class TestCloudflareConnectionJob < ApplicationJob
  queue_as :default

  discard_on ActiveRecord::RecordNotFound

  def perform(credential_id)
    credential = CloudflareCredential.find(credential_id)

    Rails.logger.info "[TestCloudflareConnectionJob] Testing connection for credential #{credential_id}"

    service = CloudflareService.new(credential)

    if service.test_connection
      credential.mark_connected!
      Rails.logger.info "[TestCloudflareConnectionJob] Connection successful"
    else
      credential.mark_error!("Connection test failed")
      Rails.logger.warn "[TestCloudflareConnectionJob] Connection failed"
    end
  rescue CloudflareService::AuthenticationError => e
    credential.mark_error!("Authentication failed: #{e.message}")
    Rails.logger.error "[TestCloudflareConnectionJob] Auth error: #{e.message}"
  rescue CloudflareService::ApiError => e
    credential.mark_error!("API error: #{e.message}")
    Rails.logger.error "[TestCloudflareConnectionJob] API error: #{e.message}"
  end
end
