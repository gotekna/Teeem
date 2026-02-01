# SSoT: Mailbox address configured in TenantSetting.monitored_mailbox_newcase
class ProcessNewCaseEmailsJob < ApplicationJob
  queue_as :default

  def perform
    # SSoT: Get the monitored mailbox from configuration
    newcase_address = TenantSetting.monitored_mailbox_newcase

    # Find emails sent to newcase@ mailbox that don't have proposals yet
    new_case_emails = SyncedEmail
      .where("? = ANY(to_emails)", newcase_address)
      .where.not(id: EmailCaseProposal.select(:synced_email_id))
      .where("created_at > ?", 1.hour.ago) # Only process recent emails
      .order(received_at: :desc)

    return if new_case_emails.empty?

    Rails.logger.info "[ProcessNewCaseEmails] Found #{new_case_emails.count} emails to process (sent to #{newcase_address})"

    new_case_emails.each do |email|
      process_email(email)
    end
  end

  private

  def process_email(email)
    # Get the user who synced this email (or fallback to first admin)
    user = email.synced_by_user || User.first

    unless user
      Rails.logger.error "[ProcessNewCaseEmails] No user found to create proposal for email #{email.id}"
      return
    end

    # Create case proposal using the service
    service = EmailToCaseService.new(email, user: user)
    proposal = service.create_case_proposal

    Rails.logger.info "[ProcessNewCaseEmails] Created proposal #{proposal.id} for email #{email.id} (confidence: #{proposal.confidence_score_value})"

    # Notify user about new proposal
    notify_user_of_new_proposal(user, proposal)

  rescue EmailToCaseService::RateLimitError => e
    Rails.logger.warn "[ProcessNewCaseEmails] Rate limit hit for user #{user.id}: #{e.message}"
  rescue StandardError => e
    Rails.logger.error "[ProcessNewCaseEmails] Failed to process email #{email.id}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
  end

  def notify_user_of_new_proposal(user, proposal)
    # For now, just log. Later can add:
    # - Email notification
    # - In-app notification
    # - ActionCable real-time update
    Rails.logger.info "[ProcessNewCaseEmails] Case proposal #{proposal.id} ready for review by #{user.name}"
  end
end
