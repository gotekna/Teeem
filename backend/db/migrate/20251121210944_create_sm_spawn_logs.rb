class CreateSmSpawnLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_spawn_logs do |t|
      # Foreign Keys
      t.references :parent_task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }
      t.references :spawned_task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }

      # Spawn Configuration
      t.string :spawn_type, null: false, limit: 50 # photo, scan, office, inspection_retry
      t.string :spawn_trigger, null: false, limit: 50 # parent_complete, inspection_fail

      # Audit
      t.timestamp :spawned_at, null: false, default: -> { 'NOW()' }
      t.references :spawned_by, foreign_key: { to_table: :users, on_delete: :nullify }

      t.timestamps
    end

    # Indexes
    add_index :sm_spawn_logs, :spawn_type
  end
end
