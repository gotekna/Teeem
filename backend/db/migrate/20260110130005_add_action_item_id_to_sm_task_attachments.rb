class AddActionItemIdToSmTaskAttachments < ActiveRecord::Migration[8.0]
  def change
    add_reference :sm_task_attachments, :action_item,
                  foreign_key: { to_table: :task_action_items },
                  null: true
  end
end
