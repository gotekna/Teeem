# frozen_string_literal: true

namespace :tasks do
  desc "Backfill email file attachments for tasks with auto_attach_email_files enabled"
  task backfill_email_attachments: :environment do
    puts "Starting backfill of email file attachments..."
    puts "=" * 60

    total_tasks = 0
    total_emails = 0
    total_files_attached = 0
    errors = []

    # Find all tasks with auto_attach_email_files enabled (default is true)
    SmTask.where(auto_attach_email_files: true).find_each do |task|
      total_tasks += 1

      # Find all email attachments for this task
      email_attachments = task.sm_task_attachments.where(attachable_type: 'SyncedEmail')

      email_attachments.each do |email_attachment|
        total_emails += 1
        email = email_attachment.attachable

        next unless email.respond_to?(:document_attachments)

        # Get document attachments (excludes small signature images)
        docs = email.respond_to?(:document_attachments) ? email.document_attachments : email.attachment_documents

        docs.each do |doc|
          # Skip if already attached (active or soft-deleted)
          next if SmTaskAttachment.with_deleted.exists?(
            sm_task_id: task.id,
            attachable_type: 'WarehouseDocument',
            attachable_id: doc.id
          )

          begin
            SmTaskAttachment.create!(
              sm_task_id: task.id,
              attachable: doc,
              attachment_type: 'document',
              category: email_attachment.category,
              added_by_id: email_attachment.added_by_id,
              auto_attached: true,
              source_email_attachment_id: email_attachment.id
            )
            total_files_attached += 1
            print "."
          rescue StandardError => e
            errors << "Task #{task.id}, Email #{email.id}, Doc #{doc.id}: #{e.message}"
            print "x"
          end
        end
      end
    end

    puts
    puts "=" * 60
    puts "Backfill complete!"
    puts "  Tasks processed:    #{total_tasks}"
    puts "  Emails processed:   #{total_emails}"
    puts "  Files attached:     #{total_files_attached}"

    if errors.any?
      puts
      puts "Errors encountered (#{errors.count}):"
      errors.first(10).each { |e| puts "  - #{e}" }
      puts "  ... and #{errors.count - 10} more" if errors.count > 10
    end
  end

  desc "Show stats for email file attachments that would be backfilled"
  task backfill_email_attachments_dry_run: :environment do
    puts "Dry run - scanning for email file attachments to backfill..."
    puts "=" * 60

    total_tasks = 0
    total_emails = 0
    total_files_to_attach = 0
    already_attached = 0

    SmTask.where(auto_attach_email_files: true).find_each do |task|
      total_tasks += 1

      email_attachments = task.sm_task_attachments.where(attachable_type: 'SyncedEmail')

      email_attachments.each do |email_attachment|
        total_emails += 1
        email = email_attachment.attachable

        next unless email.respond_to?(:document_attachments)

        docs = email.respond_to?(:document_attachments) ? email.document_attachments : email.attachment_documents

        docs.each do |doc|
          if SmTaskAttachment.with_deleted.exists?(
            sm_task_id: task.id,
            attachable_type: 'WarehouseDocument',
            attachable_id: doc.id
          )
            already_attached += 1
          else
            total_files_to_attach += 1
          end
        end
      end
    end

    puts "Dry run complete!"
    puts "  Tasks with auto_attach enabled: #{total_tasks}"
    puts "  Emails attached to tasks:       #{total_emails}"
    puts "  Files to attach (new):          #{total_files_to_attach}"
    puts "  Files already attached:         #{already_attached}"
    puts
    puts "Run 'rails tasks:backfill_email_attachments' to perform the backfill."
  end
end
