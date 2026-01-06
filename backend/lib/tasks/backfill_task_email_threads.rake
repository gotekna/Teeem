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
          SmTaskAttachment.create!(
            sm_task: task,
            attachable: email,
            attachment_type: "email",
            notes: "Backfill: Thread email"
          )
          added_count += 1

          # Send notifications for this email (same as live sync)
          notify_task_users(task, email)
        rescue ActiveRecord::RecordInvalid => e
          puts "  Warning: Could not attach email #{email.id} to task #{task_id}: #{e.message}"
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
  end
end
