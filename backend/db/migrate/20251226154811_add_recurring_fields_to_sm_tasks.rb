class AddRecurringFieldsToSmTasks < ActiveRecord::Migration[7.2]
  def change
    # Track which tasks were generated from recurring definitions
    unless column_exists?(:sm_tasks, :recurring_task_definition_id)
      add_reference :sm_tasks, :recurring_task_definition,
                    foreign_key: { to_table: :sm_recurring_task_definitions },
                    null: true
    end

    # Track the sequence number for recurring tasks
    unless column_exists?(:sm_tasks, :recurring_sequence)
      add_column :sm_tasks, :recurring_sequence, :integer # 1st, 2nd, 3rd occurrence
    end

    # Track source of task creation
    unless column_exists?(:sm_tasks, :source_type)
      add_column :sm_tasks, :source_type, :string, default: 'manual'
      # Values: 'manual' (created by user), 'recurring' (auto-generated), 'job' (from job template)
    end

    add_index :sm_tasks, :recurring_task_definition_id, if_not_exists: true
    add_index :sm_tasks, :source_type, if_not_exists: true
  end
end
