class RenameTasksToSmTasks < ActiveRecord::Migration[8.0]
  def change
    rename_table :tasks, :sm_tasks
  end
end
