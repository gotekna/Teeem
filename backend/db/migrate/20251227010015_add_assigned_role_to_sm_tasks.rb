class AddAssignedRoleToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :assigned_role, :string
  end
end
