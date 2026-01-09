# Track materialized view refresh history for monitoring and debugging
class CreateMvRefreshLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :mv_refresh_logs do |t|
      t.string :view_name, null: false
      t.datetime :started_at, null: false
      t.datetime :completed_at
      t.integer :row_count
      t.integer :previous_row_count
      t.float :duration_seconds
      t.string :status, null: false, default: 'in_progress'  # in_progress, success, failed
      t.text :error_message
      t.string :triggered_by  # scheduled, manual, webhook
      t.jsonb :metadata, default: {}  # Additional context

      t.timestamps
    end

    add_index :mv_refresh_logs, :view_name
    add_index :mv_refresh_logs, :status
    add_index :mv_refresh_logs, :started_at
    add_index :mv_refresh_logs, [ :view_name, :status ]
    add_index :mv_refresh_logs, [ :view_name, :started_at ]
  end
end
