# frozen_string_literal: true

class AddTaskAttachmentTemplates < ActiveRecord::Migration[8.0]
  def up
    StorageConfiguration.find_each do |config|
      folders = config.warehouse_root_folders || {}
      
      # Add task_attachments and task_responses if missing
      # SSoT: These paths match Entity Config UI (Tasks/{{TaskId}}/...)
      folders['task_attachments'] ||= 'Tasks/{{TaskId}}/Attachments'
      folders['task_responses'] ||= 'Tasks/{{TaskId}}/Responses'
      
      # Also fix 'task' if it has wrong path
      if folders['task']&.start_with?('Jobs/')
        folders['task'] = 'Tasks/{{TaskId}}'
      end
      
      config.update_column(:warehouse_root_folders, folders)
    end
  end

  def down
    # No-op - safe to leave the keys
  end
end
