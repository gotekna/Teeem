# frozen_string_literal: true

# ProcessNewTaskEmailsJob - Background job to process emails sent to newtask@ mailbox
#
# Runs every 5 minutes (configured in recurring.yml) to:
# 1. Find emails sent to the monitored newtask mailbox that haven't been processed
# 2. Create tasks from each email using EmailToTaskService
# 3. Notify the assigned user
#
# SSoT: Mailbox address configured in TenantSetting.monitored_mailbox_newtask
#
class ProcessNewTaskEmailsJob < ApplicationJob
  queue_as :default

  def perform
    # SSoT: Get the monitored mailbox from configuration
    newtask_address = TenantSetting.monitored_mailbox_newtask

    # Find emails sent to the monitored mailbox that haven't been processed
    # A processed email has an SmTaskAttachment with the "Source email" notes
    new_task_emails = SyncedEmail
      .where("? = ANY(to_emails)", newtask_address)
      .where.not(id: processed_email_ids)
      .where("received_at > ?", 24.hours.ago) # Only process recent emails
      .order(received_at: :desc)

    return if new_task_emails.empty?

    Rails.logger.info "[ProcessNewTaskEmails] Found #{new_task_emails.count} emails to process"

    new_task_emails.each do |email|
      process_email(email)
    end
  end

  private

  def process_email(email)
    # Get the user who synced this email (or fallback to first admin)
    user = email.synced_by_user || User.first

    unless user
      Rails.logger.error "[ProcessNewTaskEmails] No user found for email #{email.id}"
      return
    end

    # Create task using the service
    service = EmailToTaskService.new(email, user: user)
    task = service.create_task

    Rails.logger.info "[ProcessNewTaskEmails] Created task ##{task.id} from email ##{email.id}"

    # Send notification
    notify_task_created(task, email)
  rescue EmailToTaskService::TaskCreationError => e
    Rails.logger.error "[ProcessNewTaskEmails] Failed to process email #{email.id}: #{e.message}"
  rescue StandardError => e
    Rails.logger.error "[ProcessNewTaskEmails] Error processing email #{email.id}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
  end

  def processed_email_ids
    # Emails already attached to tasks as source
    SmTaskAttachment
      .where(attachable_type: "SyncedEmail")
      .where("notes LIKE ?", "Source email%")
      .pluck(:attachable_id)
  end

  def notify_task_created(task, email)
    # Notify assigned user (but skip self-notification when sender = assigned user)
    return unless task.assigned_user_id.present?

    # Find sender user (if internal)
    sender_user = User.find_by("LOWER(email) = ?", email.from_email&.downcase)

    # Skip notification if assigned user is the sender (avoid self-notification)
    if sender_user && sender_user.id == task.assigned_user_id
      Rails.logger.info "[ProcessNewTaskEmails] Skipping self-notification for task ##{task.id} (sender is assignee)"
      return
    end

    Notification.create!(
      user_id: task.assigned_user_id,
      notification_type: "task_created_from_email",
      notifiable: task,
      title: "Task created from email",
      message: "A task was created from email: #{task.name}"
    )
  rescue StandardError => e
    Rails.logger.error "[ProcessNewTaskEmails] Failed to send notification: #{e.message}"
  end
end
