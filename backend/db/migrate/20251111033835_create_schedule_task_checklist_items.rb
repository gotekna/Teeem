class CreateScheduleTaskChecklistItems < ActiveRecord::Migration[8.0]
  def change
    create_table :schedule_task_checklist_items do |t|
      t.references :schedule_task, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.string :category # Group items (e.g., "Safety", "Quality", "Pre-Start")
      t.boolean :is_completed, default: false
      t.datetime :completed_at
      t.string :completed_by
      t.integer :sequence_order, default: 0

      t.timestamps
    end

    add_index :schedule_task_checklist_items, [ :schedule_task_id, :sequence_order ]
    add_index :schedule_task_checklist_items, :is_completed
  end
end
