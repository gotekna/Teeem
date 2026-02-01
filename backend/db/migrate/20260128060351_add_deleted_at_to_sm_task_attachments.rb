class AddDeletedAtToSmTaskAttachments < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_task_attachments, :deleted_at, :datetime
    add_column :sm_task_attachments, :deleted_by_id, :bigint
    add_index :sm_task_attachments, :deleted_at
    add_foreign_key :sm_task_attachments, :users, column: :deleted_by_id, on_delete: :nullify
  end
end
