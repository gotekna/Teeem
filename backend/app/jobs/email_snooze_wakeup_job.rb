# frozen_string_literal: true

# EmailSnoozeWakeupJob - Wake up snoozed emails that have reached their time
#
# Runs every minute via recurring.yml to check for snoozed emails
# that have reached their snooze_until time and brings them back.
#
class EmailSnoozeWakeupJob < ApplicationJob
  queue_as :default

  def perform
    start_time = Time.current
    woken = 0
    errors = 0

    Rails.logger.info "[EmailSnoozeWakeupJob] Starting snooze wakeup check at #{start_time}"

    # Find all snoozes ready to wake and process them
    EmailSnooze.ready_to_wake.find_each do |snooze|
      process_wakeup(snooze)
      woken += 1
    rescue StandardError => e
      errors += 1
      Rails.logger.error "[EmailSnoozeWakeupJob] Error waking snooze #{snooze.id}: #{e.message}"
    end

    duration = Time.current - start_time
    Rails.logger.info "[EmailSnoozeWakeupJob] Completed: #{woken} woken, #{errors} errors in #{duration.round(2)}s"

    { woken: woken, errors: errors, duration: duration }
  end

  private

  def process_wakeup(snooze)
    return unless snooze.is_active?
    return unless snooze.email_warehouse.present?

    # This method creates the notification and marks snooze inactive
    snooze.wakeup!

    # Broadcast via ActionCable for real-time UI update
    broadcast_wakeup(snooze)

    Rails.logger.info "[EmailSnoozeWakeupJob] Woke up email #{snooze.email_warehouse_id} for user #{snooze.user_id}"
  end

  def broadcast_wakeup(snooze)
    # Broadcast to user's EmailChannel for real-time UI update
    EmailChannel.broadcast_to(
      snooze.user,
      {
        type: "email_snooze_wakeup",
        email_id: snooze.email_warehouse_id,
        subject: snooze.email_warehouse.subject,
        snoozed_at: snooze.created_at&.iso8601,
        woken_at: snooze.woken_at&.iso8601
      }
    )
  rescue StandardError => e
    Rails.logger.warn "[EmailSnoozeWakeupJob] Could not broadcast wakeup: #{e.message}"
  end
end
