# frozen_string_literal: true

namespace :tasks do
  desc "Backfill email threads for existing task email attachments"
  task backfill_email_threads: :environment do
    puts "Starting email thread backfill..."

    # Find all tasks with email attachments
    task_ids_with_emails = SmTaskAttachment
      .where(attachable_type: "EmailWarehouse")
      .distinct
      .pluck(:sm_task_id)

    puts "Found #{task_ids_with_emails.count} tasks with email attachments"

    total_added = 0
    tasks_updated = 0
    total_notifications = 0

    task_ids_with_emails.each do |task_id|
      task = SmTask.find_by(id: task_id)
      next unless task

      # Get all conversation_ids for emails attached to this task
      attached_emails = SmTaskAttachment
        .where(sm_task_id: task_id, attachable_type: "EmailWarehouse")
        .includes(:attachable)
        .map(&:attachable)
        .compact

      conversation_ids = attached_emails.map(&:conversation_id).compact.uniq
      next if conversation_ids.empty?

      # Find all emails in these conversations that aren't already attached
      attached_email_ids = attached_emails.map(&:id)

      thread_emails = EmailWarehouse
        .where(conversation_id: conversation_ids)
        .where.not(id: attached_email_ids)

      if thread_emails.any?
        added_count = 0
        thread_emails.each do |email|
          begin
            SmTaskAttachment.create!(
              sm_task: task,
              attachable: email,
              attachment_type: "email",
              notes: "Backfill: Thread email"
            )
            added_count += 1

            # Send notifications for this email
            notified = notify_task_users(task, email)
            total_notifications += notified
          rescue ActiveRecord::RecordInvalid => e
            puts "  Warning: Could not attach email #{email.id} to task #{task_id}: #{e.message}"
          end
        end

        if added_count > 0
          puts "  Task ##{task_id} (#{task.name.truncate(30)}): Added #{added_count} thread emails"
          total_added += added_count
          tasks_updated += 1
        end
      end
    end

    puts "\nBackfill complete!"
    puts "  Tasks updated: #{tasks_updated}"
    puts "  Emails attached: #{total_added}"
    puts "  Notifications sent: #{total_notifications}"
  end

  # Helper method to notify task users
  def notify_task_users(task, email)
    sender_email = email.from_email&.downcase
    notified_user_ids = Set.new
    notification_message = "#{email.from_name || email.from_email}: #{email.subject}"

    # 1. Notify assigned user
    if task.assigned_user_id.present?
      assigned_user = User.find_by(id: task.assigned_user_id)
      if assigned_user && assigned_user.email&.downcase != sender_email
        Notification.create!(
          user: assigned_user,
          notification_type: "task_email_reply",
          notifiable: task,
          title: "Email thread on '#{task.name.truncate(50)}'",
          message: notification_message
        )
        notified_user_ids << assigned_user.id
      end
    end

    # 2. Notify task creator
    if task.created_by_id.present? && !notified_user_ids.include?(task.created_by_id)
      creator = User.find_by(id: task.created_by_id)
      if creator && creator.email&.downcase != sender_email
        Notification.create!(
          user: creator,
          notification_type: "task_email_reply",
          notifiable: task,
          title: "Email thread on '#{task.name.truncate(50)}'",
          message: notification_message
        )
        notified_user_ids << creator.id
      end
    end

    # 3. Notify all followers
    task.followers.each do |follower|
      next if notified_user_ids.include?(follower.id)
      next if follower.email&.downcase == sender_email

      Notification.create!(
        user: follower,
        notification_type: "task_email_reply",
        notifiable: task,
        title: "Email thread on '#{task.name.truncate(50)}'",
        message: notification_message
      )
      notified_user_ids << follower.id
    end

    notified_user_ids.size
  rescue StandardError => e
    puts "    Warning: Failed to notify users: #{e.message}"
    0
  end
end
