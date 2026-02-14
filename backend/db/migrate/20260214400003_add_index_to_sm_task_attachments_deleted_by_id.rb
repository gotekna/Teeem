class AddIndexToSmTaskAttachmentsDeletedById < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :sm_task_attachments, :deleted_by_id,
              algorithm: :concurrently,
              if_not_exists: true
  end
end
