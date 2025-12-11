# Sends reminder notifications for tasks due soon
# Run daily via scheduler: bin/rails runner "BpmnDueDateReminderJob.perform_now"
class BpmnDueDateReminderJob < ApplicationJob
  queue_as :default

  # Reminder windows
  DUE_SOON_HOURS = 24    # Tasks due within 24 hours
  OVERDUE_GRACE_HOURS = 2 # Don't spam - only notify if overdue by at least 2 hours

  def perform
    Rails.logger.info("BPMN DueDateReminderJob: Starting due date check")

    remind_due_soon_tasks
    remind_overdue_tasks

    Rails.logger.info("BPMN DueDateReminderJob: Completed")
  end

  private

  def remind_due_soon_tasks
    # Find tasks due within next 24 hours that haven't been reminded
    tasks = BpmnTaskInstance
      .actionable
      .user_tasks
      .where("due_date > ? AND due_date <= ?", Time.current, DUE_SOON_HOURS.hours.from_now)
      .where("reminded_at IS NULL OR reminded_at < ?", 24.hours.ago)

    tasks.find_each do |task|
      notify_due_soon(task)
      task.update_column(:reminded_at, Time.current)
    end

    Rails.logger.info("BPMN DueDateReminderJob: Sent #{tasks.count} due soon reminders")
  end

  def remind_overdue_tasks
    # Find overdue tasks that haven't been reminded about being overdue
    tasks = BpmnTaskInstance
      .actionable
      .user_tasks
      .where("due_date < ?", OVERDUE_GRACE_HOURS.hours.ago)
      .where("overdue_reminded_at IS NULL OR overdue_reminded_at < ?", 24.hours.ago)

    tasks.find_each do |task|
      notify_overdue(task)
      task.update_column(:overdue_reminded_at, Time.current)
    end

    Rails.logger.info("BPMN DueDateReminderJob: Sent #{tasks.count} overdue reminders")
  end

  def notify_due_soon(task)
    user = task.assigned_to
    return unless user.is_a?(User)

    subject_name = task.subject&.try(:name) || task.subject&.try(:title) || "Unknown"
    hours_until = ((task.due_date - Time.current) / 1.hour).round

    Notification.create!(
      user: user,
      notification_type: "task_due_soon",
      title: "Task due soon: #{task.display_name}",
      body: "This task is due in #{hours_until} hours. #{task.process_name} for #{subject_name}.",
      notifiable: task,
      data: {
        task_id: task.id,
        task_name: task.display_name,
        due_date: task.due_date,
        hours_until: hours_until
      }
    )
  rescue StandardError => e
    Rails.logger.error("BPMN DueDateReminderJob: Failed to create due soon notification for task #{task.id}: #{e.message}")
  end

  def notify_overdue(task)
    user = task.assigned_to
    return unless user.is_a?(User)

    subject_name = task.subject&.try(:name) || task.subject&.try(:title) || "Unknown"
    hours_overdue = ((Time.current - task.due_date) / 1.hour).round

    Notification.create!(
      user: user,
      notification_type: "task_overdue",
      title: "Task overdue: #{task.display_name}",
      body: "This task is #{hours_overdue} hours overdue. #{task.process_name} for #{subject_name}.",
      notifiable: task,
      data: {
        task_id: task.id,
        task_name: task.display_name,
        due_date: task.due_date,
        hours_overdue: hours_overdue
      }
    )
  rescue StandardError => e
    Rails.logger.error("BPMN DueDateReminderJob: Failed to create overdue notification for task #{task.id}: #{e.message}")
  end
end
