class CreateTakeoffRoomInstances < ActiveRecord::Migration[7.2]
  def change
    create_table :takeoff_room_instances do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :takeoff_template, null: false, foreign_key: true
      t.references :job, null: true, foreign_key: true
      t.references :job_plan, null: true, foreign_key: true
      t.references :docsort_item, null: true, foreign_key: true
      t.string :name, null: false
      t.string :status, null: false, default: "in_progress"
      t.integer :display_order, default: 0
      t.text :notes
      t.references :created_by, null: true, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :takeoff_room_instances, [:job_plan_id, :display_order]
    add_index :takeoff_room_instances, [:docsort_item_id, :display_order]
    add_index :takeoff_room_instances, [:job_plan_id, :name]
    add_index :takeoff_room_instances, [:docsort_item_id, :name]
  end
end
