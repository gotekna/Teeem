class CreateSmRolloverLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_rollover_logs do |t|
      # Batch Identification
      t.uuid :rollover_batch_id, null: false
      t.timestamp :rollover_timestamp, null: false

      # Task Changes
      t.references :task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }
      t.date :old_start_date
      t.date :new_start_date
      t.date :old_end_date
      t.date :new_end_date

      # Dependency Deletions
      t.jsonb :deleted_dependencies, default: []

      # Status Changes
      t.string :confirm_status_change, limit: 255
      t.boolean :hold_cleared, default: false
      t.integer :supplier_confirms_cleared, default: 0

      # Metadata
      t.references :construction, null: false, foreign_key: { on_delete: :cascade }
      t.integer :cascade_depth
      t.boolean :cross_job_cascade, default: false

      t.timestamps
    end

    # Indexes
    add_index :sm_rollover_logs, :rollover_batch_id
    add_index :sm_rollover_logs, :rollover_timestamp
  end
end
