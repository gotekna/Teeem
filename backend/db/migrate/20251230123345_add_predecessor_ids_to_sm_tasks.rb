class AddPredecessorIdsToSmTasks < ActiveRecord::Migration[8.0]
  def change
    # Add predecessor_ids jsonb column matching SmScheduleMaster structure
    # Format: [{id: task_number, lag: 0, type: "FS"}, ...]
    # This enables sync service to auto-sync dependencies from templates
    add_column :sm_tasks, :predecessor_ids, :jsonb, default: []

    # Add GIN index for fast containment queries (same as sm_schedule_masters)
    add_index :sm_tasks, :predecessor_ids, using: :gin, name: 'index_sm_tasks_on_predecessor_ids_gin'
  end
end
