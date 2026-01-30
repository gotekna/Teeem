# frozen_string_literal: true

# Email-to-Task Auto-Attach Sweep
# FRC (Jan 2026): BulkEmailSyncJob doesn't call auto_attach_to_task,
# so emails from historical imports never get attached to tasks.
# This sweep finds and attaches missing emails based on task keywords.

namespace :emails do
  desc "Sweep for emails that should be attached to tasks but aren't"
  task :sweep_task_attachments, [:dry_run] => :environment do |_t, args|
    dry_run = args[:dry_run] == "true"

    puts "=" * 60
    puts "EMAIL-TO-TASK AUTO-ATTACH SWEEP"
    puts "Mode: #{dry_run ? 'DRY RUN (no changes)' : 'LIVE (will create attachments)'}"
    puts "=" * 60
    puts ""

    # Find all tasks with email_keywords
    tasks_with_keywords = SmTask.where.not(email_keywords: [nil, ""])
    puts "Tasks with email_keywords: #{tasks_with_keywords.count}"
    puts ""

    total_attachments_created = 0
    total_tasks_updated = 0

    tasks_with_keywords.find_each do |task|
      # Find emails matching this task's keywords
      matching_emails = find_matching_emails(task)

      # Filter out already attached
      unattached = matching_emails.reject do |email|
        SmTaskAttachment.where(sm_task_id: task.id, attachable: email).exists? ||
        SmTaskAttachment.was_deleted?(sm_task_id: task.id, attachable_type: "SyncedEmail", attachable_id: email.id)
      end

      next if unattached.empty?

      puts "Task ##{task.id}: #{task.name.truncate(50)}"
      puts "  Keywords: #{task.email_keywords.truncate(60)}"
      puts "  Found #{unattached.count} unattached emails:"

      task_attachments_created = 0
      unattached.each do |email|
        puts "    - #{email.subject&.truncate(50)} (#{email.from_email})"

        unless dry_run
          begin
            SmTaskAttachment.create!(
              sm_task: task,
              attachable: email,
              attachment_type: "email",
              notes: "Auto-attached by sweep (matched keywords)"
            )
            task_attachments_created += 1
          rescue => e
            puts "      ERROR: #{e.message}"
          end
        end
      end

      if dry_run
        puts "  Would create #{unattached.count} attachments"
      else
        puts "  Created #{task_attachments_created} attachments"
      end
      puts ""

      total_attachments_created += task_attachments_created unless dry_run
      total_tasks_updated += 1 if task_attachments_created > 0 || dry_run
    end

    puts "=" * 60
    puts "SUMMARY"
    puts "=" * 60
    puts "Tasks processed: #{total_tasks_updated}"
    if dry_run
      puts "Attachments that would be created: (run without dry_run to create)"
    else
      puts "Attachments created: #{total_attachments_created}"
    end
  end

  def find_matching_emails(task)
    return [] if task.email_keywords.blank?

    keywords = task.email_keywords.split(",").map(&:strip).map(&:downcase).reject(&:blank?)
    return [] if keywords.empty?

    # Build query for emails containing any keyword in subject or body
    # Limit to last 6 months for performance
    base_query = SyncedEmail.where("received_at > ?", 6.months.ago)

    matching_ids = []

    keywords.each do |keyword|
      # Find emails where subject contains keyword
      ids = base_query.where("LOWER(subject) LIKE ?", "%#{keyword}%").pluck(:id)
      matching_ids.concat(ids)
    end

    SyncedEmail.where(id: matching_ids.uniq).order(received_at: :desc).limit(50)
  end
end
