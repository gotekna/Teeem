# frozen_string_literal: true

# SSoT: Email Reminder Job
# Runs every minute to process email reminders that are due.
# Creates notifications for users when their email reminders trigger.
#
class EmailReminderJob < ApplicationJob
  queue_as :default

  def perform
    processed_count = EmailUserState.process_due_reminders!

    if processed_count.positive?
      Rails.logger.info("[EmailReminder] Processed #{processed_count} email reminders")
    end

    processed_count
  rescue StandardError => e
    Rails.logger.error("[EmailReminder] Error: #{e.message}")
    raise
  end
end
