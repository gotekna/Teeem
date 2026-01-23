# frozen_string_literal: true

namespace :emails do
  desc "Backfill: Link existing emails in threads to tasks (one-time migration)"
  task backfill_task_thread_emails: :environment do
    puts "🔍 Finding emails in threads linked to tasks..."

    # Find all conversation_ids that have at least one email linked to a task
    linked_conversation_ids = SyncedEmail
      .joins("INNER JOIN sm_task_attachments ON sm_task_attachments.attachable_id = synced_emails.id AND sm_task_attachments.attachable_type = 'SyncedEmail'")
      .where.not(conversation_id: nil)
      .distinct
      .pluck(:conversation_id)

    puts "Found #{linked_conversation_ids.count} conversation threads with task links"

    total_linked = 0
    total_skipped = 0

    linked_conversation_ids.each_with_index do |conv_id, index|
      # Find all task attachments for this conversation
      task_attachments = SmTaskAttachment
        .joins("INNER JOIN synced_emails ON synced_emails.id = sm_task_attachments.attachable_id")
        .where(attachable_type: "SyncedEmail")
        .where("synced_emails.conversation_id = ?", conv_id)
        .select("sm_task_attachments.sm_task_id, sm_task_attachments.category, sm_task_attachments.added_by_id")
        .distinct

      # Find all emails in this conversation
      thread_emails = SyncedEmail.where(conversation_id: conv_id)

      # For each email, link to each task if not already linked
      thread_emails.each do |email|
        task_attachments.each do |ta|
          # Skip if already linked
          if SmTaskAttachment.exists?(
            sm_task_id: ta.sm_task_id,
            attachable_type: "SyncedEmail",
            attachable_id: email.id
          )
            total_skipped += 1
            next
          end

          # Create link
          SmTaskAttachment.create!(
            sm_task_id: ta.sm_task_id,
            attachable: email,
            attachment_type: "email",
            category: ta.category || "response",
            added_by_id: ta.added_by_id
          )
          total_linked += 1
        end
      end

      # Progress indicator
      if (index + 1) % 100 == 0
        puts "  Processed #{index + 1}/#{linked_conversation_ids.count} threads (#{total_linked} linked, #{total_skipped} skipped)"
      end
    end

    puts ""
    puts "✅ Backfill complete!"
    puts "   #{total_linked} emails linked to tasks"
    puts "   #{total_skipped} already linked (skipped)"
  end
end
