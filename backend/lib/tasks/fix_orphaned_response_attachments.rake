# frozen_string_literal: true

# FRC Fix (Jan 2026): Restore visibility of response attachments that lost their
# action_item_id due to question deletion.
#
# Root Cause: When a TaskActionItem (question) was deleted, `dependent: :nullify`
# cleared action_item_id on linked SmTaskAttachments without setting category='response'.
# This caused them to disappear from Response Files (which filters by
# action_item_id OR category='response').
#
# This rake task restores visibility by setting category='response' for attachments
# that appear to be orphaned response files.

namespace :task_attachments do
  desc "Fix orphaned response attachments that lost visibility due to question deletion"
  task fix_orphaned_responses: :environment do
    puts "Looking for orphaned response attachments..."

    # Find attachments that:
    # 1. Have no action_item_id (was nullified)
    # 2. Have no category set (neither 'info' nor 'response')
    # 3. Are NOT source emails (is_source != true)
    # These are likely former response attachments that lost their status

    orphaned = SmTaskAttachment
      .where(action_item_id: nil)
      .where(category: [nil, ''])
      .where.not(is_source: true)

    count = orphaned.count

    if count == 0
      puts "No orphaned response attachments found."
      exit
    end

    puts "Found #{count} potentially orphaned response attachments."
    puts ""
    puts "Sample (first 10):"
    orphaned.limit(10).each do |att|
      task_name = att.sm_task&.name || "Unknown task"
      puts "  - ID #{att.id}: Task '#{task_name.truncate(50)}', type: #{att.attachable_type}"
    end
    puts ""

    print "Set category='response' for all #{count} attachments? (yes/no): "
    answer = $stdin.gets&.strip

    if answer&.downcase == 'yes'
      updated = orphaned.update_all(category: 'response')
      puts "Updated #{updated} attachments to category='response'"
      puts "These attachments should now appear in Response Files."
    else
      puts "Aborted. No changes made."
    end
  end

  desc "Preview orphaned response attachments (dry run)"
  task preview_orphaned_responses: :environment do
    orphaned = SmTaskAttachment
      .where(action_item_id: nil)
      .where(category: [nil, ''])
      .where.not(is_source: true)
      .includes(:sm_task)

    count = orphaned.count
    puts "Found #{count} potentially orphaned response attachments:\n\n"

    orphaned.group(:sm_task_id).count.each do |task_id, att_count|
      task = SmTask.find_by(id: task_id)
      task_name = task&.name || "Unknown task"
      puts "  Task #{task_id} (#{task_name.truncate(50)}): #{att_count} attachments"
    end
  end
end
