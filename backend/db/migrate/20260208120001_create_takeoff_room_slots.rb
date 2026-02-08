class CreateTakeoffRoomSlots < ActiveRecord::Migration[7.2]
  def change
    create_table :takeoff_room_slots do |t|
      t.references :takeoff_room_instance, null: false, foreign_key: true
      t.integer :step_index, null: false
      t.string :label, null: false
      t.string :measurement_type, null: false
      t.string :color
      t.string :prompt
      t.references :pricebook_item, null: true, foreign_key: true
      t.references :measurement, null: true, foreign_key: { to_table: :unreal_measurements }
      t.decimal :quantity, precision: 15, scale: 4, default: 0
      t.boolean :is_filled, null: false, default: false

      t.timestamps
    end

    add_index :takeoff_room_slots, [:takeoff_room_instance_id, :step_index], unique: true, name: "idx_room_slots_instance_step"
  end
end
