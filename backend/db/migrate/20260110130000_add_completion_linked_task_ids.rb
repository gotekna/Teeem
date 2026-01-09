class AddCompletionLinkedTaskIds < ActiveRecord::Migration[7.0]
  def change
    # Add to SmScheduleMaster (template level)
    add_column :sm_schedule_masters, :completion_linked_task_ids, :jsonb, default: []

    # Add to SmTask (runtime level - copied from template when applied)
    add_column :sm_tasks, :completion_linked_task_ids, :jsonb, default: []
  end
end
