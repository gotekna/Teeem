class CreateSmTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_tasks do |t|
      # Foreign Keys
      t.references :construction, null: false, foreign_key: { on_delete: :cascade }
      t.references :template_row, foreign_key: { to_table: :schedule_template_rows, on_delete: :nullify }
      t.bigint :parent_task_id

      # Identification
      t.integer :task_number, null: false
      t.string :name, null: false, limit: 255
      t.text :description

      # Hierarchy & Ordering
      t.decimal :sequence_order, precision: 10, scale: 2, null: false

      # Scheduling (ACTUAL DATES - not offsets)
      t.date :start_date, null: false
      t.date :end_date, null: false
      t.integer :duration_days, null: false

      # Status & Workflow
      t.string :status, null: false, default: 'not_started', limit: 50
      t.timestamp :started_at
      t.timestamp :completed_at
      t.boolean :passed # For pass/fail inspections (nullable)

      # Lock Fields (cascade blockers)
      t.boolean :confirm, default: false
      t.boolean :supplier_confirm, default: false
      t.boolean :manually_positioned, default: false
      t.timestamp :manually_positioned_at

      # Supplier Workflow
      t.string :confirm_status, limit: 50
      t.timestamp :confirm_requested_at
      t.timestamp :supplier_confirmed_at
      t.references :supplier_confirmed_by, foreign_key: { to_table: :users, on_delete: :nullify }

      # Hold Task Fields
      t.boolean :is_hold_task, default: false
      t.references :hold_reason, foreign_key: { to_table: :sm_hold_reasons, on_delete: :nullify }
      t.timestamp :hold_started_at
      t.references :hold_started_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamp :hold_released_at
      t.references :hold_released_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.text :hold_release_reason

      # Cost & Resources
      t.references :purchase_order, foreign_key: { on_delete: :nullify }
      t.references :assigned_user, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :supplier, foreign_key: { to_table: :contacts, on_delete: :nullify }
      t.string :trade, limit: 100
      t.string :stage, limit: 100

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
      t.references :checklist, foreign_key: { to_table: :supervisor_checklist_templates, on_delete: :nullify }

      # Reminders
      t.integer :order_time_days
      t.integer :call_time_days
      t.boolean :order_reminder_sent, default: false
      t.boolean :call_reminder_sent, default: false

      # Requirements Flags
      t.boolean :require_photo, default: false
      t.boolean :require_certificate, default: false
      t.boolean :require_supervisor_check, default: false
      t.boolean :po_required, default: false
      t.boolean :critical_po, default: false

      # Audit
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :updated_by, foreign_key: { to_table: :users, on_delete: :nullify }

      t.timestamps
    end

    # Self-referential foreign key for parent_task_id
    add_foreign_key :sm_tasks, :sm_tasks, column: :parent_task_id, on_delete: :nullify

    # Indexes
    add_index :sm_tasks, :status
    add_index :sm_tasks, :start_date
    add_index :sm_tasks, :sequence_order
    add_index :sm_tasks, :trade
    add_index :sm_tasks, :confirm_status
    add_index :sm_tasks, :is_hold_task, where: "is_hold_task = true"
    add_index :sm_tasks, :parent_task_id
    add_index :sm_tasks, [:construction_id, :task_number], unique: true
  end
end
