class AddParentItemToTaskActionItems < ActiveRecord::Migration[8.0]
  def change
    add_reference :task_action_items, :parent_item,
                  foreign_key: { to_table: :task_action_items },
                  null: true
    add_index :task_action_items, [:parent_item_id, :position]
  end
end
