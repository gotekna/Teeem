class CreateScheduleTemplateRows < ActiveRecord::Migration[8.0]
  def change
    create_table :schedule_template_rows do |t|
      t.references :schedule_template, null: false, foreign_key: true
      t.string :name, null: false
      t.references :supplier, foreign_key: true  # Optional - blank means internal task
      t.jsonb :predecessor_ids, default: [], null: false
      t.boolean :po_required, default: false, null: false
      t.boolean :create_po_on_job_start, default: false, null: false
      t.jsonb :price_book_item_ids, default: [], null: false
      t.boolean :critical_po, default: false, null: false
      t.jsonb :tags, default: [], null: false
      t.boolean :require_photo, default: false, null: false
      t.boolean :require_certificate, default: false, null: false
      t.integer :cert_lag_days, default: 10, null: false
      t.boolean :require_supervisor_check, default: false, null: false
      t.boolean :auto_complete_predecessors, default: false, null: false
      t.boolean :has_subtasks, default: false, null: false
      t.integer :subtask_count
      t.jsonb :subtask_names, default: [], null: false
      t.integer :sequence_order, null: false

      t.timestamps
    end

    add_index :schedule_template_rows, :sequence_order
    add_index :schedule_template_rows, [ :schedule_template_id, :sequence_order ]
  end
end
