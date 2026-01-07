# frozen_string_literal: true

# Sends notifications for tasks that have become overdue
# Runs daily at 8am to catch tasks that passed their due date
#
# Logic:
# - Find all tasks where end_date < today and status is not completed
# - Only notify if we haven't already notified for this task (check notification exists)
# - Notify the assigned user
#
class TaskOverdueNotificationJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[TaskOverdueNotification] Starting overdue check..."

    today = Date.current
    notified_count = 0

    # Find overdue tasks that:
    # - Have an end_date before today
    # - Are not completed/cancelled
    # - Have an assigned user
    overdue_tasks = SmTask
      .where("end_date < ?", today)
      .where.not(status: %w[completed cancelled])
      .where.not(assigned_user_id: nil)
      .includes(:assigned_user, :job)

    overdue_tasks.find_each do |task|
      # Skip if we've already sent an overdue notification for this task
      existing = Notification.find_by(
        notifiable: task,
        notification_type: "task_overdue"
      )
      next if existing.present?

      # Create the notification
      days_overdue = (today - task.end_date).to_i
      job_name = task.job&.name || "Unknown Job"

      Notification.create!(
        user_id: task.assigned_user_id,
        notifiable: task,
        notification_type: "task_overdue",
        title: "Task overdue: #{task.name}",
        message: "The task \"#{task.name}\" on job \"#{job_name}\" is #{days_overdue} day#{'s' if days_overdue != 1} overdue."
      )

      notified_count += 1
      Rails.logger.info "[TaskOverdueNotification] Notified #{task.assigned_user.name} about overdue task: #{task.name}"
    rescue StandardError => e
      Rails.logger.error "[TaskOverdueNotification] Failed to notify for task #{task.id}: #{e.message}"
    end

    Rails.logger.info "[TaskOverdueNotification] Complete. Sent #{notified_count} notifications."
    { notified: notified_count }
  end
end
