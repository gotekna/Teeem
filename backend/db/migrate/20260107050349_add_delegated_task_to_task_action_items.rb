class AddDelegatedTaskToTaskActionItems < ActiveRecord::Migration[8.0]
  def change
    # Link to the sub-task created for delegation (optional - most items won't have this)
    add_reference :task_action_items, :delegated_task, null: true, foreign_key: { to_table: :sm_tasks }
  end
end
