# frozen_string_literal: true

# SSoT Rename (Jan 2026): StorageLocation → WarehouseFolder
# This clarifies the purpose: these are warehouse folder configurations
#
# Renames:
# - entity_tabs table → warehouse_folders
# - entity_tab_document_types table → warehouse_folder_document_types
# - storage_location_id column → warehouse_folder_id
class RenameEntityTabsToWarehouseFolders < ActiveRecord::Migration[8.0]
  def change
    # Rename main table
    rename_table :entity_tabs, :warehouse_folders

    # Rename join table
    rename_table :entity_tab_document_types, :warehouse_folder_document_types

    # Rename foreign key column in join table
    rename_column :warehouse_folder_document_types, :storage_location_id, :warehouse_folder_id
  end
end
