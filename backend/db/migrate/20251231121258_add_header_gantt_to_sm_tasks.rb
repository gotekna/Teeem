class AddHeaderGanttToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :header_gantt, :string
  end
end
