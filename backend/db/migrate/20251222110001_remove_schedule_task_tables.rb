class RemoveScheduleTaskTables < ActiveRecord::Migration[8.0]
  # Phase 6 Tier 1: Remove deprecated ScheduleTask system
  # These tables are no longer used - frontend fully migrated to SmTask
  # See TEEEM_DOCS/PHASE6_DELETION_AUDIT.md for details

  def up
    # Remove foreign keys first
    remove_foreign_key :schedule_task_checklist_items, :schedule_tasks, if_exists: true

    # Drop child table first
    drop_table :schedule_task_checklist_items, if_exists: true

    # Drop parent table
    drop_table :schedule_tasks, if_exists: true
  end

  def down
    # Recreate schedule_tasks table
    create_table :schedule_tasks do |t|
      t.references :job, foreign_key: true
      t.references :purchase_order, foreign_key: true
      t.string :name
      t.text :description
      t.string :trade
      t.string :stage
      t.date :start_date
      t.date :end_date
      t.integer :duration_days
      t.string :status, default: "not_started"
      t.boolean :is_milestone, default: false
      t.timestamps
    end

    # Recreate schedule_task_checklist_items table
    create_table :schedule_task_checklist_items do |t|
      t.references :schedule_task, null: false, foreign_key: true
      t.string :name
      t.boolean :completed, default: false
      t.timestamps
    end
  end
end
