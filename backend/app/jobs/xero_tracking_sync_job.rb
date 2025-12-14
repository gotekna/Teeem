# frozen_string_literal: true

# Background job to sync a job with Xero tracking categories
# Creates a new tracking option in Xero and links it to the job
class XeroTrackingSyncJob < ApplicationJob
  queue_as :default

  # Retry on temporary failures
  retry_on XeroApiClient::RateLimitError, wait: :polynomially_longer, attempts: 3
  retry_on XeroApiClient::ApiError, wait: 5.minutes, attempts: 2

  # Don't retry auth errors - they require manual intervention
  discard_on XeroApiClient::AuthenticationError

  def perform(job_id)
    job = Job.find_by(id: job_id)
    return unless job

    # Skip if already linked
    return if job.xero_tracking_option_id.present?

    service = XeroTrackingSyncService.new
    result = service.create_tracking_option_for_job(job)

    if result[:success]
      Rails.logger.info("XeroTrackingSyncJob: Created tracking option for job ##{job_id}: #{result[:tracking_option_name]}")
    else
      Rails.logger.warn("XeroTrackingSyncJob: Failed to create tracking option for job ##{job_id}: #{result[:error]}")
    end
  end
end
