class CreateInspectionRooms < ActiveRecord::Migration[7.1]
  def change
    create_table :inspection_rooms do |t|
      t.bigint :tenant_id, null: false
      t.references :property_inspection, null: false, foreign_key: true
      t.string :name, null: false
      t.string :room_type, null: false, default: "other"
      t.integer :sort_order, null: false, default: 0
      t.string :overall_condition
      t.text :notes

      t.timestamps
    end

    add_index :inspection_rooms, :tenant_id
    add_index :inspection_rooms, [:property_inspection_id, :sort_order], name: "idx_inspection_rooms_on_inspection_and_order"
  end
end
