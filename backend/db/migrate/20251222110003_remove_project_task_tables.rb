# Phase 6 Tier 4: Remove ProjectTask system
# SmTask is THE ONE task system (SSoT)
class RemoveProjectTaskTables < ActiveRecord::Migration[8.0]
  def up
    # Remove foreign key columns from WHS/Meeting models
    # (SmTask references already exist via sm_task_id)
    if column_exists?(:whs_action_items, :project_task_id)
      remove_column :whs_action_items, :project_task_id
    end

    if column_exists?(:meeting_agenda_items, :created_task_id)
      remove_column :meeting_agenda_items, :created_task_id
    end

    # Remove project_task_id from purchase_orders if exists
    if column_exists?(:purchase_orders, :project_task_id)
      remove_column :purchase_orders, :project_task_id
    end

    # Remove schedule_task_id from purchase_orders if exists (cleanup from Tier 1)
    if column_exists?(:purchase_orders, :schedule_task_id)
      remove_column :purchase_orders, :schedule_task_id
    end

    # Drop tables in dependency order (children first)
    drop_table :task_updates, if_exists: true
    drop_table :task_dependencies, if_exists: true
    drop_table :project_task_checklist_items, if_exists: true
    drop_table :project_tasks, if_exists: true
  end

  def down
    # Recreate project_tasks table
    create_table :project_tasks do |t|
      t.references :project, foreign_key: true
      t.references :job, foreign_key: true
      t.references :construction
      t.references :purchase_order, foreign_key: true
      t.references :schedule_template_row
      t.references :parent_task
      t.references :task_template, foreign_key: true
      t.references :user, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.string :status, default: "not_started"
      t.string :task_type
      t.integer :sequence_order
      t.date :planned_start_date
      t.date :planned_end_date
      t.date :actual_start_date
      t.date :actual_end_date
      t.integer :duration_days
      t.integer :progress_percentage, default: 0
      t.boolean :is_critical_path, default: false
      t.boolean :is_milestone, default: false
      t.boolean :requires_photo, default: false
      t.boolean :requires_site_cert, default: false
      t.integer :lag_days, default: 0
      t.integer :buffer_days, default: 0
      t.timestamps
    end

    # Recreate project_task_checklist_items table
    create_table :project_task_checklist_items do |t|
      t.references :project_task, foreign_key: true
      t.string :description, null: false
      t.boolean :completed, default: false
      t.datetime :completed_at
      t.timestamps
    end

    # Recreate task_dependencies table
    create_table :task_dependencies do |t|
      t.references :predecessor_task
      t.references :successor_task
      t.string :dependency_type, default: "finish_to_start"
      t.integer :lag_days, default: 0
      t.timestamps
    end

    # Recreate task_updates table
    create_table :task_updates do |t|
      t.references :project_task, foreign_key: true
      t.references :user, foreign_key: true
      t.string :update_type
      t.text :notes
      t.integer :progress_percentage
      t.timestamps
    end

    # Re-add FK columns
    add_reference :whs_action_items, :project_task, foreign_key: true
    add_reference :meeting_agenda_items, :created_task, foreign_key: { to_table: :project_tasks }
  end
end
