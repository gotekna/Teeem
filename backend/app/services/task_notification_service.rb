# frozen_string_literal: true

# Service for notifying task followers of changes
#
# Usage:
#   TaskNotificationService.notify_followers(task, :task_updated_followed, "Task updated", "Description changed")
#   TaskNotificationService.notify_followers(task, :task_comment_followed, "New comment on task", nil, exclude_user: current_user)
#
class TaskNotificationService
  class << self
    # Notify all followers of a task about a change
    # @param task [SmTask] the task that changed
    # @param notification_type [String/Symbol] one of Notification::TYPES
    # @param title [String] notification title
    # @param message [String, nil] optional additional message
    # @param exclude_user [User, nil] optional user to exclude (e.g., the person who made the change)
    def notify_followers(task, notification_type, title, message = nil, exclude_user: nil)
      return if task.nil?

      followers = task.followers
      followers = followers.where.not(id: exclude_user.id) if exclude_user

      followers.find_each do |user|
        Notification.create!(
          user: user,
          notifiable: task,
          notification_type: notification_type.to_s,
          title: title,
          message: message
        )
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error "Failed to create notification for user #{user.id}: #{e.message}"
      end
    end

    # Notify followers when task status changes
    def notify_status_change(task, old_status, new_status, changed_by: nil)
      return if old_status == new_status

      title = "Task '#{task.name}' status changed to #{new_status.humanize}"
      notify_followers(task, :task_updated_followed, title, nil, exclude_user: changed_by)
    end

    # Notify followers when a comment is added
    def notify_new_comment(task, comment, comment_author: nil)
      title = "New comment on '#{task.name}'"
      message = comment.body.truncate(100) if comment.respond_to?(:body)
      notify_followers(task, :task_comment_followed, title, message, exclude_user: comment_author)
    end

    # Notify followers when task details change
    def notify_task_updated(task, changed_fields, changed_by: nil)
      return if changed_fields.blank?

      title = "Task '#{task.name}' was updated"
      message = "Changed: #{changed_fields.join(', ')}"
      notify_followers(task, :task_updated_followed, title, message, exclude_user: changed_by)
    end
  end
end
