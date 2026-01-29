# frozen_string_literal: true

# FRC Fix (Jan 2026): Update task folder paths to use FULL paths instead of suffix-only
#
# Root Cause: task_attachments and task_responses stored only suffix ("Attachments", "Responses")
# and relied on WAREHOUSE_TYPE_PARENTS derivation. This caused path computation to be scattered
# across multiple files with hardcoded fallbacks.
#
# Fix: Store FULL paths for each type. No derivation, no hardcoding, fail fast if path is wrong.
#
# Before:
#   task: "Tasks/{{TaskId}}"
#   task_attachments: "Attachments"
#   task_responses: "Responses"
#
# After:
#   task: "Tasks/{{TaskId}}/{{TaskName}}"
#   task_attachments: "Tasks/{{TaskId}}/{{TaskName}}/Attachments"
#   task_responses: "Tasks/{{TaskId}}/{{TaskName}}/Responses"
#
class UpdateTaskWarehouseFoldersToFullPaths < ActiveRecord::Migration[7.1]
  def up
    StorageConfiguration.find_each do |sc|
      warehouse_folders = sc.warehouse_folders || {}

      # Get the task base path (may have been customized)
      # Default: "Tasks/{{TaskId}}" but could be custom
      task_base = warehouse_folders['task']

      # If task base doesn't include TaskName, add it
      unless task_base&.include?('{{TaskName}}')
        task_base = task_base&.gsub(/\/?$/, '') # Remove trailing slash if any
        task_base = "#{task_base}/{{TaskName}}" if task_base.present?
      end

      # Use default if blank
      task_base ||= 'Tasks/{{TaskId}}/{{TaskName}}'

      # Build full paths for child types
      new_folders = warehouse_folders.merge(
        'task' => task_base,
        'task_attachments' => "#{task_base}/Attachments",
        'task_responses' => "#{task_base}/Responses"
      )

      sc.update_column(:warehouse_folders, new_folders)

      puts "[Migration] Updated StorageConfiguration ##{sc.id}: task folders now use full paths"
    end
  end

  def down
    # Revert to suffix-only paths (not recommended but reversible)
    StorageConfiguration.find_each do |sc|
      warehouse_folders = sc.warehouse_folders || {}

      # Extract just TaskId from the path for the base
      task_path = warehouse_folders['task']
      if task_path&.include?('{{TaskName}}')
        # Remove TaskName to go back to old format
        task_path = task_path.gsub('/{{TaskName}}', '')
      end

      new_folders = warehouse_folders.merge(
        'task' => task_path || 'Tasks/{{TaskId}}',
        'task_attachments' => 'Attachments',
        'task_responses' => 'Responses'
      )

      sc.update_column(:warehouse_folders, new_folders)

      puts "[Migration] Reverted StorageConfiguration ##{sc.id}: task folders back to suffix-only"
    end
  end
end
