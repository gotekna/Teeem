class CreateSmHoldLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_hold_logs do |t|
      # Foreign Keys
      t.references :construction, null: false, foreign_key: { on_delete: :cascade }
      t.references :hold_task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }
      t.references :hold_reason, foreign_key: { to_table: :sm_hold_reasons, on_delete: :nullify }

      # Hold Event
      t.string :event_type, null: false, limit: 20 # hold_started, hold_released

      # Hold Start Details
      t.timestamp :hold_started_at
      t.references :hold_started_by, foreign_key: { to_table: :users, on_delete: :nullify }

      # Hold Release Details
      t.timestamp :hold_released_at
      t.references :hold_released_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.text :hold_release_reason

      # Impact Tracking
      t.integer :supplier_confirms_cleared, default: 0
      t.integer :dependencies_cleared, default: 0
      t.integer :tasks_affected, default: 0

      t.timestamps
    end

    # Indexes
    add_index :sm_hold_logs, :event_type
  end
end
