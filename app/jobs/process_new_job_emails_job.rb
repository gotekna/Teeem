class ProcessNewJobEmailsJob < ApplicationJob
  queue_as :default

  # Folder name to monitor for new job emails
  NEW_JOB_FOLDER_NAME = 'A - New Job'

  def perform
    # Find all emails in the "A - New Job" folder that don't have proposals yet
    new_job_emails = EmailWarehouse
      .where(folder_name: NEW_JOB_FOLDER_NAME)
      .where.not(id: EmailJobProposal.select(:email_warehouse_id))
      .where('created_at > ?', 1.hour.ago) # Only process recent emails
      .order(received_at: :desc)

    return if new_job_emails.empty?

    Rails.logger.info "[ProcessNewJobEmails] Found #{new_job_emails.count} emails in '#{NEW_JOB_FOLDER_NAME}' folder to process"

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
