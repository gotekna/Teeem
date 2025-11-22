class CreateSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_template_rows do |t|
      # Foreign Keys
      t.references :sm_template, null: false, foreign_key: true
      t.references :parent_row, foreign_key: { to_table: :sm_template_rows }
      t.references :supplier, foreign_key: { to_table: :contacts }

      # Identification
      t.integer :task_number, null: false
      t.string :name, null: false
      t.text :description

      # Hierarchy & Ordering
      t.decimal :sequence_order, precision: 10, scale: 2, null: false

      # Scheduling (relative days, not actual dates)
      t.integer :duration_days, null: false, default: 1
      t.integer :start_day_offset, default: 0  # Day offset from job start

      # Dependencies (stored as JSONB array)
      # Format: [{ "id": 2, "type": "FS", "lag": 3 }, ...]
      t.jsonb :predecessor_ids, default: []

      # Trade & Assignment
      t.string :trade
      t.string :stage
      t.string :assigned_role  # For internal assignment (admin, sales, site, etc.)

      # Documentation Integration
      t.integer :documentation_category_ids, array: true, default: []
      t.boolean :show_in_docs_tab, default: false

      # Linked Requirements
      t.jsonb :linked_task_ids, default: []

      # Task Spawning Configuration
      t.boolean :spawn_photo_task, default: false
      t.boolean :spawn_scan_task, default: false
      t.jsonb :spawn_office_tasks, default: []
      t.boolean :pass_fail_enabled, default: false
      t.references :checklist, foreign_key: { to_table: :supervisor_checklist_templates }

      # Reminders (days before task)
      t.integer :order_time_days
      t.integer :call_time_days

      # Requirements Flags
      t.boolean :require_photo, default: false
      t.boolean :require_certificate, default: false
      t.boolean :require_supervisor_check, default: false
      t.boolean :po_required, default: false
      t.boolean :critical_po, default: false
      t.boolean :create_po_on_job_start, default: false

      # Certificate lag (days after completion before cert required)
      t.integer :cert_lag_days, default: 0

      # Subtasks
      t.boolean :has_subtasks, default: false
      t.integer :subtask_count
      t.string :subtask_names, array: true, default: []

      # Price Book Integration
      t.integer :price_book_item_ids, array: true, default: []

      # Tags
      t.string :tags, array: true, default: []

      # Color coding
      t.string :color

      # Active/Deleted
      t.boolean :is_active, default: true

      # Audit
      t.bigint :created_by_id
      t.bigint :updated_by_id
      t.timestamps
    end

    add_index :sm_template_rows, [:sm_template_id, :task_number], unique: true
    add_index :sm_template_rows, [:sm_template_id, :sequence_order]
    add_index :sm_template_rows, :trade
    add_index :sm_template_rows, :stage
    add_index :sm_template_rows, :is_active
    add_foreign_key :sm_template_rows, :users, column: :created_by_id
    add_foreign_key :sm_template_rows, :users, column: :updated_by_id
  end
end
