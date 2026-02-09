# frozen_string_literal: true

# SSoT Consolidation: Rename BaseFolder → WarehouseFolder
#
# This migration renames all "base_folder" references to "warehouse_folder"
# to match the API naming convention (/api/v1/warehouse_folders).
#
# Changes:
# - base_folders → warehouse_folders
# - base_folder_document_types → warehouse_folder_document_types
# - base_folder_id → warehouse_folder_id (FK column)
# - base_folder_document_type_id → warehouse_folder_document_type_id (FK column)
# - All related indexes and foreign key constraints
#
class RenameBaseFolderToWarehouseFolder < ActiveRecord::Migration[8.0]
  def change
    # Step 1: Rename the main tables
    rename_table :base_folders, :warehouse_folders
    rename_table :base_folder_document_types, :warehouse_folder_document_types

    # Step 2: Rename FK column in warehouse_folder_document_types
    # (referencing the now-renamed warehouse_folders table)
    rename_column :warehouse_folder_document_types, :base_folder_id, :warehouse_folder_id

    # Step 3: Rename FK column in warehouse_documents
    # (referencing warehouse_folder_document_types)
    rename_column :warehouse_documents, :base_folder_document_type_id, :warehouse_folder_document_type_id

    # Rails automatically renames indexes when renaming columns/tables for standard patterns.
    # However, we need to manually rename custom-named indexes.

    # Step 4: Rename custom indexes on warehouse_folders (was base_folders)
    if index_exists?(:warehouse_folders, [:warehouse_type_id, :name], name: 'idx_base_folders_unique_name')
      rename_index :warehouse_folders, 'idx_base_folders_unique_name', 'idx_warehouse_folders_unique_name'
    end

    if index_exists?(:warehouse_folders, [:tenant_id, :warehouse_type_id, :name], name: 'idx_bf_tenant_type_name')
      rename_index :warehouse_folders, 'idx_bf_tenant_type_name', 'idx_wf_tenant_type_name'
    end

    if index_exists?(:warehouse_folders, :tenant_id, name: 'idx_bf_tenant')
      rename_index :warehouse_folders, 'idx_bf_tenant', 'idx_wf_tenant'
    end

    # Step 5: Rename custom indexes on warehouse_folder_document_types
    if index_exists?(:warehouse_folder_document_types, [:warehouse_folder_id, :document_type_id], name: 'idx_bfdt_unique')
      rename_index :warehouse_folder_document_types, 'idx_bfdt_unique', 'idx_wfdt_unique'
    end

    if index_exists?(:warehouse_folder_document_types, [:document_type_id, :is_primary], name: 'idx_bfdt_primary')
      rename_index :warehouse_folder_document_types, 'idx_bfdt_primary', 'idx_wfdt_primary'
    end

    if index_exists?(:warehouse_folder_document_types, :ui_name_template, name: 'idx_bfdt_ui_name_template')
      rename_index :warehouse_folder_document_types, 'idx_bfdt_ui_name_template', 'idx_wfdt_ui_name_template'
    end

    if index_exists?(:warehouse_folder_document_types, :download_name_template, name: 'idx_bfdt_download_name_template')
      rename_index :warehouse_folder_document_types, 'idx_bfdt_download_name_template', 'idx_wfdt_download_name_template'
    end
  end
end
