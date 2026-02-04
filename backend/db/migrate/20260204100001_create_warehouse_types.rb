# frozen_string_literal: true

# Migration: Create warehouse_types table
#
# Part of the Database-Driven Warehouse Types & Base Folders feature.
# This table replaces the hardcoded WAREHOUSE_TYPES constant, allowing
# users to create/edit warehouse types via UI.
#
# SSoT: warehouse_types is THE ONE source for all warehouse type definitions.
#
class CreateWarehouseTypes < ActiveRecord::Migration[7.2]
  def change
    create_table :warehouse_types do |t|
      t.string :code, null: false
      t.string :display_name, null: false
      t.text :description
      t.string :icon_name
      t.boolean :is_system, default: false, null: false
      t.boolean :enabled, default: true, null: false
      t.integer :order_position, default: 0, null: false

      t.timestamps
    end

    add_index :warehouse_types, :code, unique: true
    add_index :warehouse_types, :enabled
    add_index :warehouse_types, :order_position
  end
end
