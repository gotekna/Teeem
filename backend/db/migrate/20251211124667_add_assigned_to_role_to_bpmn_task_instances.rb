class AddAssignedToRoleToBpmnTaskInstances < ActiveRecord::Migration[8.0]
  def change
    add_column :bpmn_task_instances, :assigned_to_role, :string
  end
end
