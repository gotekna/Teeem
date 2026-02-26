# frozen_string_literal: true

# EmailNotificationsJob - Process snooze wakeups and email reminders
#
# FRC (Feb 2026): Merged EmailSnoozeWakeupJob + EmailReminderJob into one job.
# Both are lightweight notification checks that run on the email worker.
# Running them separately doubled scheduling overhead for two sub-second jobs.
#
# Runs every 15 minutes via recurring.yml on :email_sync queue.
#
class EmailNotificationsJob < ApplicationJob
  include DeduplicatableJob
  queue_as :email_sync

  # Don't retry on failure - runs every 15 minutes, next run will try again.
  # Prevents queue clog from failed jobs piling up.
  discard_on StandardError

  def perform
    results = { snooze_woken: 0, snooze_errors: 0, reminders_sent: 0, reminder_errors: 0 }

    process_snooze_wakeups(results)
    process_reminders(results)

    Rails.logger.info "[EmailNotifications] Completed: #{results.inspect}"
    results
  end

  private

  # ============================================
  # Snooze Wakeups (from EmailSnoozeWakeupJob)
  # ============================================

  def process_snooze_wakeups(results)
    EmailSnooze.ready_to_wake.find_each do |snooze|
      process_wakeup(snooze)
      results[:snooze_woken] += 1
    rescue StandardError => e
      results[:snooze_errors] += 1
      Rails.logger.error "[EmailNotifications] Error waking snooze #{snooze.id}: #{e.message}"
    end
  end

  def process_wakeup(snooze)
    return unless snooze.is_active?
    return unless snooze.email_warehouse.present?

    snooze.wakeup!
    broadcast_wakeup(snooze)

    Rails.logger.info "[EmailNotifications] Woke up email #{snooze.email_warehouse_id} for user #{snooze.user_id}"
  end

  def broadcast_wakeup(snooze)
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
    Rails.logger.warn "[EmailNotifications] Could not broadcast wakeup: #{e.message}"
  end

  # ============================================
  # Reminders (from EmailReminderJob)
  # ============================================

  def process_reminders(results)
    EmailUserState.reminders_due.find_each do |state|
      process_reminder(state)
      results[:reminders_sent] += 1
    rescue StandardError => e
      results[:reminder_errors] += 1
      Rails.logger.error "[EmailNotifications] Error processing reminder #{state.id}: #{e.message}"
    end
  end

  def process_reminder(state)
    return if state.reminder_sent?
    return unless state.email_warehouse.present?

    Notification.create!(
      user: state.user,
      notifiable: state.email_warehouse,
      notification_type: "email_reminder",
      title: "Email Reminder",
      message: "Reminder: #{state.email_warehouse.subject.to_s.truncate(100)}"
    )

    state.update!(reminder_sent: true)
    broadcast_reminder(state)

    Rails.logger.info "[EmailNotifications] Sent reminder for email #{state.email_warehouse_id} to user #{state.user_id}"
  end

  def broadcast_reminder(state)
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
    Rails.logger.warn "[EmailNotifications] Could not broadcast reminder: #{e.message}"
  end
end
