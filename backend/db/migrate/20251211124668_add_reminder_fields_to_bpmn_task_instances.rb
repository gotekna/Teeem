class AddReminderFieldsToBpmnTaskInstances < ActiveRecord::Migration[8.0]
  def change
    add_column :bpmn_task_instances, :reminded_at, :datetime
    add_column :bpmn_task_instances, :overdue_reminded_at, :datetime
  end
end
