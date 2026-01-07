class ProcessNewJobEmailsJob < ApplicationJob
  queue_as :default

  # Email address to monitor for new job emails
  NEW_JOB_EMAIL_ADDRESS = "newjob@tekna.com.au"

  # Legacy folder name (kept for backwards compatibility)
  NEW_JOB_FOLDER_NAME = "A - New Job"

  def perform
    # Find emails sent to newjob@tekna.com.au OR in "A - New Job" folder
    # that don't have proposals yet
    # SSoT: Use LOWER() for folder name (case-insensitive matching)
    new_job_emails = EmailWarehouse
      .where("? = ANY(to_emails) OR LOWER(folder_name) = LOWER(?)", NEW_JOB_EMAIL_ADDRESS, NEW_JOB_FOLDER_NAME)
      .where.not(id: EmailJobProposal.select(:email_warehouse_id))
      .where("created_at > ?", 1.hour.ago) # Only process recent emails
      .order(received_at: :desc)

    return if new_job_emails.empty?

    Rails.logger.info "[ProcessNewJobEmails] Found #{new_job_emails.count} emails to process (sent to #{NEW_JOB_EMAIL_ADDRESS} or in '#{NEW_JOB_FOLDER_NAME}' folder)"

    new_job_emails.each do |email|
      process_email(email)
    end
  end

  private

  def process_email(email)
    # Get the user who synced this email (or fallback to first admin)
    user = email.synced_by_user || User.first

    unless user
      Rails.logger.error "[ProcessNewJobEmails] No user found to create proposal for email #{email.id}"
      return
    end

    # Create job proposal using the service
    service = EmailToJobService.new(email, user: user)
    proposal = service.create_job_proposal

    Rails.logger.info "[ProcessNewJobEmails] Created proposal #{proposal.id} for email #{email.id} (confidence: #{proposal.confidence_score})"

    # TODO: Send notification to user about new proposal
    # Could use ActionCable, email, or in-app notification
    notify_user_of_new_proposal(user, proposal)

  rescue EmailToJobService::RateLimitError => e
    Rails.logger.warn "[ProcessNewJobEmails] Rate limit hit for user #{user.id}: #{e.message}"
  rescue StandardError => e
    Rails.logger.error "[ProcessNewJobEmails] Failed to process email #{email.id}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
  end

  def notify_user_of_new_proposal(user, proposal)
    # For now, just log. Later can add:
    # - Email notification
    # - In-app notification
    # - ActionCable real-time update
    Rails.logger.info "[ProcessNewJobEmails] Proposal #{proposal.id} ready for review by #{user.name}"
  end
end
