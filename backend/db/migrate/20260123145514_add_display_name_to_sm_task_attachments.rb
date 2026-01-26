class AddDisplayNameToSmTaskAttachments < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_task_attachments, :display_name, :string
  end
end
