class ProcessNewEmailJob < ApplicationJob
  queue_as :default

  # Process a newly synced email for job matching and other post-sync actions
  # Called by ImapSyncJob after each new email is saved
  def perform(email_id)
    email = EmailWarehouse.find_by(id: email_id)
    return unless email

    # Skip if already assigned to a job
    return if email.job_id.present?

    # Try to auto-assign to a job based on matching rules
    # Priority: explicit ID > thread inheritance > address match > contact match
    job = email.auto_assign_to_job!(min_confidence: 0.7)

    if job
      Rails.logger.info "[ProcessNewEmailJob] Auto-assigned email #{email_id} to job #{job.id}"
    end
  rescue StandardError => e
    Rails.logger.error "[ProcessNewEmailJob] Error processing email #{email_id}: #{e.message}"
  end
end
