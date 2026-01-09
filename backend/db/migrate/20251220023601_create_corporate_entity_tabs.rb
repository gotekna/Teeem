class CreateCorporateEntityTabs < ActiveRecord::Migration[8.0]
  def change
    create_table :corporate_entity_tabs do |t|
      t.string :tab_key, null: false
      t.string :display_name, null: false
      t.string :tab_group, default: "documents" # documents, overview, data, special
      t.string :entity_types, array: true, default: [] # ["Company", "Trust", "Superfund"]
      t.integer :order_position, default: 0
      t.boolean :enabled, default: true
      t.string :icon_name
      t.text :description
      t.string :component_name # Optional: specific React component to render

      t.timestamps
    end

    add_index :corporate_entity_tabs, :tab_key, unique: true
    add_index :corporate_entity_tabs, :tab_group
    add_index :corporate_entity_tabs, :enabled
    add_index :corporate_entity_tabs, :order_position
  end
end
