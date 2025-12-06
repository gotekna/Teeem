class CreateTaskDependencies < ActiveRecord::Migration[8.0]
  def change
    create_table :task_dependencies do |t|
      t.references :successor_task, null: false, foreign_key: { to_table: :project_tasks }
      t.references :predecessor_task, null: false, foreign_key: { to_table: :project_tasks }
      t.string :dependency_type, default: 'finish_to_start' # FS, SS, FF, SF
      t.integer :lag_days, default: 0 # Can be negative for overlap

      t.timestamps
    end

    # Add unique index on the pair (t.references already creates individual indexes)
    add_index :task_dependencies, [ :successor_task_id, :predecessor_task_id ],
              name: 'index_unique_task_dependency', unique: true

    # Constraint: can't depend on yourself
    reversible do |dir|
      dir.up do
        execute <<-SQL
          ALTER TABLE task_dependencies
          ADD CONSTRAINT check_no_self_dependency
          CHECK (successor_task_id != predecessor_task_id)
        SQL
      end

      dir.down do
        execute <<-SQL
          ALTER TABLE task_dependencies
          DROP CONSTRAINT check_no_self_dependency
        SQL
      end
    end
  end
end
