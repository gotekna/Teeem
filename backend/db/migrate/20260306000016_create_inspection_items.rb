class CreateInspectionItems < ActiveRecord::Migration[7.1]
  def change
    create_table :inspection_items do |t|
      t.bigint :tenant_id, null: false
      t.references :inspection_room, null: false, foreign_key: true
      t.string :name, null: false
      t.string :condition
      t.string :entry_condition
      t.text :notes
      t.boolean :is_clean, default: true
      t.boolean :is_working, default: true
      t.boolean :action_required, default: false
      t.integer :sort_order, null: false, default: 0

      t.timestamps
    end

    add_index :inspection_items, :tenant_id
    add_index :inspection_items, [:inspection_room_id, :sort_order], name: "idx_inspection_items_on_room_and_order"
    add_index :inspection_items, :action_required, where: "(action_required = true)", name: "idx_inspection_items_action_required"
  end
end
