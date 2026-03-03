class AddExcludeFromGanttToSmTasks < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_tasks, :exclude_from_gantt, :boolean, default: false, null: false
  end
end
