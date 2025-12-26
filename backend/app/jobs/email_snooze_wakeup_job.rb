# frozen_string_literal: true

# SSoT: Email Snooze Wakeup Job
# Runs every minute to wake up emails that have reached their snooze time.
# This brings snoozed emails back to the inbox.
#
class EmailSnoozeWakeupJob < ApplicationJob
  queue_as :default

  def perform
    woken_count = EmailSnooze.wakeup_ready!

    if woken_count.positive?
      Rails.logger.info("[EmailSnoozeWakeup] Woke up #{woken_count} snoozed emails")
    end

    woken_count
  rescue StandardError => e
    Rails.logger.error("[EmailSnoozeWakeup] Error: #{e.message}")
    raise
  end
end
