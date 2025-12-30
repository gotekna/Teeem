class DropSmDependenciesTable < ActiveRecord::Migration[8.0]
  def up
    # SSoT cleanup: Dependencies now stored in predecessor_ids jsonb column
    # (matching SmScheduleMaster approach)
    drop_table :sm_dependencies
  end

  def down
    create_table :sm_dependencies do |t|
      t.bigint :predecessor_task_id, null: false
      t.bigint :successor_task_id, null: false
      t.string :dependency_type, limit: 10, null: false
      t.integer :lag_days, default: 0
      t.boolean :active, default: true
      t.bigint :created_by_id
      t.bigint :deleted_by_id
      t.timestamps
    end

    add_index :sm_dependencies, :predecessor_task_id
    add_index :sm_dependencies, :successor_task_id
    add_foreign_key :sm_dependencies, :sm_tasks, column: :predecessor_task_id, on_delete: :cascade
    add_foreign_key :sm_dependencies, :sm_tasks, column: :successor_task_id, on_delete: :cascade
  end
end
