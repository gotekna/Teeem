class AddSpawnOrderAndCallTasksToSmScheduleMaster < ActiveRecord::Migration[8.0]
  def change
    # Add to template rows (sm_schedule_master)
    add_column :sm_schedule_master, :spawn_order_task, :boolean, default: false
    add_column :sm_schedule_master, :spawn_call_task, :boolean, default: false

    # Add to job tasks (sm_tasks)
    add_column :sm_tasks, :spawn_order_task, :boolean, default: false
    add_column :sm_tasks, :spawn_call_task, :boolean, default: false
  end
end
