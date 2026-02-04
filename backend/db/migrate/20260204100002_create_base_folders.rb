# frozen_string_literal: true

# Migration: Create base_folders table
#
# Part of the Database-Driven Warehouse Types & Base Folders feature.
# This table defines the base folder configuration for each warehouse type.
# Each warehouse type can have one or more base folders (e.g., "Jobs", "Contacts").
#
# SSoT: base_folders is THE ONE source for base folder definitions.
#
class CreateBaseFolders < ActiveRecord::Migration[7.2]
  def change
    create_table :base_folders do |t|
      t.references :warehouse_type, foreign_key: true, null: false
      t.string :name, null: false                     # Folder name: "Jobs", "Contacts"
      t.string :folder_path_template                  # e.g., "Jobs/{{JobCode}}"
      t.string :download_name_template                # e.g., "{Subject} - {Date}.eml"
      t.string :ui_name_template                      # e.g., "{Subject}"
      t.boolean :is_system, default: false, null: false
      t.boolean :enabled, default: true, null: false
      t.integer :order_position, default: 0, null: false

      t.timestamps
    end

    add_index :base_folders, [:warehouse_type_id, :name], unique: true, name: "idx_base_folders_unique_name"
    add_index :base_folders, :enabled
    add_index :base_folders, :order_position
  end
end
