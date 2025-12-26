class AddRequiredByToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :required_by, :date
    add_index :sm_tasks, :required_by
  end
end
