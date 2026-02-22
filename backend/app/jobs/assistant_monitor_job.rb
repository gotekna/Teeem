# frozen_string_literal: true

# AssistantMonitorJob - Proactive AI monitoring for construction managers
#
# Runs every 15 minutes to detect items that need attention:
# - Urgent emails unread for 2+ hours
# - Tasks due today that haven't started
# - Overdue tasks
# - Unread notifications older than 1 hour
#
# Creates AssistantAlert records that appear in the user's assistant panel.
# Does NOT send external notifications in Phase 1 (web alerts only).
#
class AssistantMonitorJob < ApplicationJob
  queue_as :low

  def perform
    Rails.logger.info "[AssistantMonitor] Starting proactive monitoring scan"

    # Run for each user who has used the assistant recently (active users)
    active_users = User.joins(:assistant_conversations)
                       .where("assistant_conversations.last_message_at > ?", 7.days.ago)
                       .distinct

    active_users.find_each do |user|
      ActsAsTenant.with_tenant(user.tenant) do
        monitor_for_user(user)
      end
    rescue StandardError => e
      Rails.logger.error "[AssistantMonitor] Error monitoring user #{user.id}: #{e.message}"
    end

    Rails.logger.info "[AssistantMonitor] Completed scan for #{active_users.count} users"
  end

  private

  def monitor_for_user(user)
    alerts = []
    alerts += check_urgent_emails(user)
    alerts += check_tasks_due_today(user)
    alerts += check_overdue_tasks(user)
    alerts += check_unread_notifications(user)

    # Route new alerts to user's preferred channels (Phase 5)
    if alerts.any?
      router = AssistantNotificationRouter.new(user: user)
      alerts.compact.each { |alert| router.route_alert(alert) }
    end

    # Record activity for learning (Phase 5)
    AssistantLearningService.new(user: user).record_interaction(type: "active_time")
  end

  # Urgent emails unread for 2+ hours
  def check_urgent_emails(user)
    alerts = []
    urgent_emails = SyncedEmail
      .where(is_read: false, importance: "high")
      .where("received_at < ? AND received_at > ?", 2.hours.ago, 24.hours.ago)
      .order(received_at: :desc)
      .limit(5)

    urgent_emails.each do |email|
      # Skip if we already alerted about this email
      next if AssistantAlert.exists?(
        user: user,
        source_type: "SyncedEmail",
        source_id: email.id,
        alert_type: "urgent_email"
      )

      alert = AssistantAlert.create!(
        user: user,
        tenant_id: user.tenant_id,
        alert_type: "urgent_email",
        priority: "high",
        title: "Urgent email unread: #{email.subject&.truncate(80)}",
        summary: "From #{email.from_name || email.from_email}, received #{time_ago_in_words(email.received_at)}. #{email.body_preview&.truncate(150)}",
        source_type: "SyncedEmail",
        source_id: email.id,
        context_data: {
          email_id: email.id,
          subject: email.subject,
          from: "#{email.from_name} <#{email.from_email}>",
          received_at: email.received_at
        }
      )
      alerts << alert
    end
    alerts
  end

  # Tasks due today that haven't started
  def check_tasks_due_today(user)
    tasks_due = SmTask
      .where(assigned_user_id: user.id)
      .where(start_date: Date.current)
      .where(status: "not_started")

    return [] if tasks_due.empty?

    # Create one alert for all tasks due today (avoid alert spam)
    return [] if AssistantAlert.exists?(
      user: user,
      alert_type: "task_due_today",
      status: %w[pending seen],
      created_at: Date.current.beginning_of_day..
    )

    task_names = tasks_due.limit(5).pluck(:name)

    alert = AssistantAlert.create!(
      user: user,
      tenant_id: user.tenant_id,
      alert_type: "task_due_today",
      priority: "medium",
      title: "#{tasks_due.count} task(s) due today haven't started",
      summary: task_names.join(", "),
      context_data: {
        task_count: tasks_due.count,
        task_ids: tasks_due.pluck(:id),
        task_names: task_names
      }
    )
    [alert]
  end

  # Overdue tasks (past end date, not completed)
  def check_overdue_tasks(user)
    overdue = SmTask
      .where(assigned_user_id: user.id)
      .where("end_date < ?", Date.current)
      .where.not(status: "completed")

    return [] if overdue.empty?

    # Only alert once per day about overdue tasks
    return [] if AssistantAlert.exists?(
      user: user,
      alert_type: "overdue_task",
      status: %w[pending seen],
      created_at: Date.current.beginning_of_day..
    )

    alert = AssistantAlert.create!(
      user: user,
      tenant_id: user.tenant_id,
      alert_type: "overdue_task",
      priority: "high",
      title: "#{overdue.count} overdue task(s)",
      summary: overdue.limit(5).map { |t|
        days = (Date.current - t.end_date).to_i
        "#{t.name} (#{days}d overdue)"
      }.join(", "),
      context_data: {
        task_count: overdue.count,
        task_ids: overdue.pluck(:id),
        tasks: overdue.limit(5).map { |t| { id: t.id, name: t.name, days_overdue: (Date.current - t.end_date).to_i } }
      }
    )
    [alert]
  end

  # Unread notifications older than 1 hour
  def check_unread_notifications(user)
    unread_count = Notification
      .where(user: user, read: false)
      .where("created_at < ?", 1.hour.ago)
      .count

    return [] if unread_count < 3 # Only alert if 3+ unread

    # Only alert once per day
    return [] if AssistantAlert.exists?(
      user: user,
      alert_type: "unread_notifications",
      status: %w[pending seen],
      created_at: Date.current.beginning_of_day..
    )

    alert = AssistantAlert.create!(
      user: user,
      tenant_id: user.tenant_id,
      alert_type: "unread_notifications",
      priority: "low",
      title: "#{unread_count} unread notifications",
      summary: "You have #{unread_count} unread notifications from the last hour.",
      context_data: { unread_count: unread_count }
    )
    [alert]
  end

  def time_ago_in_words(time)
    return "unknown" unless time

    diff = Time.current - time
    if diff < 1.hour
      "#{(diff / 60).to_i} minutes ago"
    elsif diff < 24.hours
      "#{(diff / 3600).to_i} hours ago"
    else
      "#{(diff / 86400).to_i} days ago"
    end
  end
end
