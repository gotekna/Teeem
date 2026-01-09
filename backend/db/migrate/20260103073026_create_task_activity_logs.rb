class CreateTaskActivityLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :task_activity_logs do |t|
      t.references :sm_task, null: false, foreign_key: true
      t.references :user, foreign_key: true  # Who made the change (can be nil for system changes)
      t.string :activity_type, null: false   # assignment_changed, status_changed, created, etc.
      t.string :field_name                   # Which field changed (e.g., "assigned_user_id")
      t.text :old_value                      # Previous value (JSON for complex values)
      t.text :new_value                      # New value (JSON for complex values)
      t.text :description                    # Human-readable description
      t.timestamps
    end

    add_index :task_activity_logs, [:sm_task_id, :created_at]
    add_index :task_activity_logs, :activity_type
  end
end
