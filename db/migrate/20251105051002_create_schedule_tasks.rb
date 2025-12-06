class CreateScheduleTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :schedule_tasks do |t|
      # Foreign keys
      t.references :construction, null: false, foreign_key: true, index: true
      t.references :purchase_order, null: true, foreign_key: true, index: true

      # Task details
      t.string :title, null: false
      t.string :status, default: 'not_started'
      t.datetime :start_date
      t.datetime :complete_date
      t.string :duration # e.g., "5d", "21d"
      t.integer :duration_days # Parsed integer value

      # Supplier information
      t.string :supplier_category
      t.string :supplier_name

      # Additional fields from spreadsheet
      t.boolean :paid_internal, default: false
      t.datetime :approx_date
      t.boolean :confirm, default: false
      t.boolean :supplier_confirm, default: false
      t.datetime :task_started
      t.datetime :completed

      # Dependencies and attachments
      t.jsonb :predecessors, default: [] # Array of task IDs/numbers
      t.text :attachments

      # Matching status
      t.boolean :matched_to_po, default: false

      # Import tracking
      t.integer :sequence_order # Original order from spreadsheet

      t.timestamps
    end

    add_index :schedule_tasks, :status
    add_index :schedule_tasks, :matched_to_po
    add_index :schedule_tasks, [ :construction_id, :matched_to_po ]
  end
end
