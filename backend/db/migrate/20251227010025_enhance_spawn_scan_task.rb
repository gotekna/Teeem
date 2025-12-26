class EnhanceSpawnScanTask < ActiveRecord::Migration[8.0]
  def change
    # Remove old boolean field
    remove_column :sm_schedule_master, :spawn_scan_task, :boolean, default: false
    remove_column :sm_tasks, :spawn_scan_task, :boolean, default: false

    # Add new fields: which task to spawn and lag days
    add_column :sm_schedule_master, :spawn_scan_task_id, :bigint
    add_column :sm_schedule_master, :spawn_scan_lag_days, :integer, default: 0
    add_column :sm_tasks, :spawn_scan_task_id, :bigint
    add_column :sm_tasks, :spawn_scan_lag_days, :integer, default: 0

    # Add foreign key references
    add_foreign_key :sm_schedule_master, :sm_schedule_master, column: :spawn_scan_task_id, on_delete: :nullify
    add_foreign_key :sm_tasks, :sm_schedule_master, column: :spawn_scan_task_id, on_delete: :nullify
  end
end
