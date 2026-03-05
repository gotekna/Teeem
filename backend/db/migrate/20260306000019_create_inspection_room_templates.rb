class CreateInspectionRoomTemplates < ActiveRecord::Migration[7.1]
  def change
    create_table :inspection_room_templates do |t|
      t.bigint :tenant_id, null: false
      t.string :property_type_name, null: false
      t.string :name, null: false
      t.jsonb :rooms, null: false, default: []
      t.boolean :is_default, default: false
      t.boolean :active, default: true

      t.timestamps
    end

    add_index :inspection_room_templates, :tenant_id
    add_index :inspection_room_templates, [:tenant_id, :property_type_name], name: "idx_inspection_templates_on_tenant_and_type"
    add_index :inspection_room_templates, [:tenant_id, :name], unique: true, name: "idx_inspection_templates_on_tenant_and_name"
  end
end
