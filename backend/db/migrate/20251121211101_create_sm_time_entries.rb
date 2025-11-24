class CreateSmTimeEntries < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_time_entries do |t|
      # Foreign Keys
      t.references :task, null: false, foreign_key: { to_table: :sm_tasks, on_delete: :cascade }
      t.references :resource, null: false, foreign_key: { to_table: :sm_resources, on_delete: :cascade }
      t.references :allocation, foreign_key: { to_table: :sm_resource_allocations, on_delete: :nullify }

      # Time Details
      t.date :entry_date, null: false
      t.time :start_time
      t.time :end_time
      t.integer :break_minutes, default: 0
      t.decimal :total_hours, precision: 10, scale: 2, null: false

      # Classification
      t.string :entry_type, limit: 20, default: 'regular' # regular, overtime, travel, standby

      # Notes
      t.text :description

      # Approval
      t.references :approved_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamp :approved_at

      # Audit
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }

      t.timestamps
    end

    # Indexes
    add_index :sm_time_entries, :entry_date
    add_index :sm_time_entries, :entry_type
    add_index :sm_time_entries, [:task_id, :resource_id, :entry_date], name: 'idx_sm_time_entries_task_resource_date'
  end
end
