class AddCategoryToSmTaskAttachments < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_task_attachments, :category, :string, default: 'info'
    add_index :sm_task_attachments, :category
  end
end
