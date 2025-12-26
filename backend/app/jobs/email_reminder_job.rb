# frozen_string_literal: true

# EmailReminderJob - Process email reminders that are due
#
# Runs every minute via recurring.yml to check for reminders
# that have reached their remind_at time and sends notifications.
#
class EmailReminderJob < ApplicationJob
  queue_as :default

  def perform
    start_time = Time.current
    processed = 0
    errors = 0

    Rails.logger.info "[EmailReminderJob] Starting reminder check at #{start_time}"

    # Find all due reminders and process them
    EmailUserState.reminders_due.find_each do |state|
      process_reminder(state)
      processed += 1
    rescue StandardError => e
      errors += 1
      Rails.logger.error "[EmailReminderJob] Error processing reminder #{state.id}: #{e.message}"
    end

    duration = Time.current - start_time
    Rails.logger.info "[EmailReminderJob] Completed: #{processed} processed, #{errors} errors in #{duration.round(2)}s"

    { processed: processed, errors: errors, duration: duration }
  end

  private

  def process_reminder(state)
    return if state.reminder_sent?
    return unless state.email_warehouse.present?

    # Create in-app notification
    Notification.create!(
      user: state.user,
      notifiable: state.email_warehouse,
      notification_type: "email_reminder",
      title: "Email Reminder",
      message: "Reminder: #{state.email_warehouse.subject.to_s.truncate(100)}"
    )

    # Mark reminder as sent
    state.update!(reminder_sent: true)

    # Broadcast via ActionCable for real-time notification
    broadcast_reminder(state)

    Rails.logger.info "[EmailReminderJob] Sent reminder for email #{state.email_warehouse_id} to user #{state.user_id}"
  end

  def broadcast_reminder(state)
    # Broadcast to user's EmailChannel for real-time UI update
    EmailChannel.broadcast_to(
      state.user,
      {
        type: "email_reminder",
        email_id: state.email_warehouse_id,
        subject: state.email_warehouse.subject,
        remind_at: state.remind_at&.iso8601
      }
    )
  rescue StandardError => e
    Rails.logger.warn "[EmailReminderJob] Could not broadcast reminder: #{e.message}"
  end
end
