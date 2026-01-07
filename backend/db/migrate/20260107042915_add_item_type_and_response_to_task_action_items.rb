class AddItemTypeAndResponseToTaskActionItems < ActiveRecord::Migration[8.0]
  def change
    # item_type: 'action' (checkbox) or 'question' (needs response)
    add_column :task_action_items, :item_type, :string, default: 'action', null: false
    # response: stores the answer for question-type items
    add_column :task_action_items, :response, :text
    # responded_by: who answered the question
    add_reference :task_action_items, :responded_by, foreign_key: { to_table: :users }
    # responded_at: when the question was answered
    add_column :task_action_items, :responded_at, :datetime
  end
end
