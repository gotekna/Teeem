class AddAutoAttachEmailFilesToSmTasks < ActiveRecord::Migration[8.0]
  def change
    # Default true = files automatically attached when email is attached to task
    # User can toggle off per-task to prevent auto-attachment
    add_column :sm_tasks, :auto_attach_email_files, :boolean, default: true, null: false
  end
end
