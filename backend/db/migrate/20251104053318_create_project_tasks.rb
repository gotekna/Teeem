class CreateProjectTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :project_tasks do |t|
      t.references :project, null: false, foreign_key: true
      t.references :task_template, foreign_key: true
      t.references :purchase_order, foreign_key: true

      # Task details
      t.string :name, null: false
      t.string :task_type, null: false
      t.string :category, null: false
      t.string :task_code # For dependency references (e.g., "SLAB_POUR")

      # Status and progress
      t.string :status, default: 'not_started'
      t.integer :progress_percentage, default: 0

      # Scheduling
      t.date :planned_start_date
      t.date :planned_end_date
      t.date :actual_start_date
      t.date :actual_end_date
      t.integer :duration_days, default: 1

      # Assignment (internal only)
      t.references :assigned_to, foreign_key: { to_table: :users }
      t.string :supplier_name # Simple text field, no login required

      # Flags
      t.boolean :is_milestone, default: false
      t.boolean :is_critical_path, default: false

      # Notes
      t.text :notes
      t.text :completion_notes

      t.timestamps
    end

    add_index :project_tasks, [ :project_id, :status ]
    add_index :project_tasks, [ :planned_start_date, :planned_end_date ]
    add_index :project_tasks, :is_critical_path
  end
end
