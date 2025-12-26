class AddAssignedRoleToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :assigned_role, :string
    add_index :sm_tasks, :assigned_role
  end
end
