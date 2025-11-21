class CreateSmDependencies < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_dependencies do |t|
      # Foreign Keys
      t.references :predecessor_task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }
      t.references :successor_task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }

      # Dependency Configuration
      t.string :dependency_type, null: false, limit: 10 # FS, SS, FF, SF
      t.integer :lag_days, null: false, default: 0 # Can be negative for lead time

      # Lifecycle Tracking
      t.boolean :active, null: false, default: true
      t.timestamp :deleted_at
      t.boolean :deleted_by_rollover, default: false
      t.string :deleted_reason, limit: 100 # rollover, user_manual, cascade_conflict, task_started, task_completed, hold_released

      # Audit
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :deleted_by, foreign_key: { to_table: :users, on_delete: :nullify }

      t.timestamps
    end

    # Indexes
    add_index :sm_dependencies, :predecessor_task_id, where: "active = true", name: 'idx_sm_deps_predecessor_active'
    add_index :sm_dependencies, :successor_task_id, where: "active = true", name: 'idx_sm_deps_successor_active'
    add_index :sm_dependencies, :active
    add_index :sm_dependencies, [:predecessor_task_id, :successor_task_id], unique: true, where: "active = true", name: 'idx_sm_deps_unique_active'

    # Check constraint to prevent self-dependency
    add_check_constraint :sm_dependencies, "predecessor_task_id != successor_task_id", name: 'no_self_dependency'
  end
end
