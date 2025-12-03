class RenameSmTasksToTasks < ActiveRecord::Migration[8.0]
  def up
    # Rename the database table
    rename_table :sm_tasks, :tasks

    # Update the foundation record to match
    execute <<-SQL
      UPDATE foundations
      SET database_table_name = 'tasks', slug = 'tasks'
      WHERE database_table_name = 'sm_tasks'
    SQL
  end

  def down
    rename_table :tasks, :sm_tasks

    execute <<-SQL
      UPDATE foundations
      SET database_table_name = 'sm_tasks', slug = 'sm_tasks'
      WHERE database_table_name = 'tasks'
    SQL
  end
end
