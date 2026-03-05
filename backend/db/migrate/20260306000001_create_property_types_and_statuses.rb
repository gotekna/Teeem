class CreatePropertyTypesAndStatuses < ActiveRecord::Migration[8.0]
  def change
    create_table :property_types do |t|
      t.bigint :tenant_id, null: false
      t.string :name, null: false
      t.string :description
      t.integer :position, default: 0
      t.boolean :is_active, default: true, null: false
      t.timestamps
    end

    add_index :property_types, :tenant_id
    add_index :property_types, [:tenant_id, :name], unique: true

    create_table :property_statuses do |t|
      t.bigint :tenant_id, null: false
      t.string :name, null: false
      t.string :color
      t.integer :position, default: 0
      t.boolean :is_active, default: true, null: false
      t.timestamps
    end

    add_index :property_statuses, :tenant_id
    add_index :property_statuses, [:tenant_id, :name], unique: true
  end
end
