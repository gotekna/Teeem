# SSoT (Feb 2026): Clean up old entity_tab naming → warehouse_folder
# - Drop orphaned corporate_entity_tabs table (27 rows, no model, no references)
# - Rename indexes to match warehouse_folder naming convention
class RenameEntityTabIndexesToWarehouseFolder < ActiveRecord::Migration[8.0]
  def up
    # 1. Drop orphaned corporate_entity_tabs table
    drop_table :corporate_entity_tabs, if_exists: true

    # 2. Rename indexes on warehouse_folder_document_types
    if index_exists?(:warehouse_folder_document_types, [:document_type_id, :is_primary], name: 'idx_entity_tab_doc_types_primary')
      rename_index :warehouse_folder_document_types, 'idx_entity_tab_doc_types_primary', 'idx_warehouse_folder_doc_types_primary'
    end

    if index_exists?(:warehouse_folder_document_types, [:warehouse_folder_id, :document_type_id], name: 'idx_entity_tab_doc_types_unique')
      rename_index :warehouse_folder_document_types, 'idx_entity_tab_doc_types_unique', 'idx_warehouse_folder_doc_types_unique'
    end

    # 3. Rename index on warehouse_folders
    if index_exists?(:warehouse_folders, [:warehouse_type, :tab_key, :job_id, :parent_id], name: 'idx_entity_tabs_unique_key')
      rename_index :warehouse_folders, 'idx_entity_tabs_unique_key', 'idx_warehouse_folders_unique_key'
    end

    # 4. Rename index on user_warehouse_folder_preferences
    if index_exists?(:user_warehouse_folder_preferences, [:user_id, :scope], name: 'idx_user_entity_tab_prefs_unique')
      rename_index :user_warehouse_folder_preferences, 'idx_user_entity_tab_prefs_unique', 'idx_user_warehouse_folder_prefs_unique'
    end
  end

  def down
    # Reverse index renames
    if index_exists?(:user_warehouse_folder_preferences, [:user_id, :scope], name: 'idx_user_warehouse_folder_prefs_unique')
      rename_index :user_warehouse_folder_preferences, 'idx_user_warehouse_folder_prefs_unique', 'idx_user_entity_tab_prefs_unique'
    end

    if index_exists?(:warehouse_folders, [:warehouse_type, :tab_key, :job_id, :parent_id], name: 'idx_warehouse_folders_unique_key')
      rename_index :warehouse_folders, 'idx_warehouse_folders_unique_key', 'idx_entity_tabs_unique_key'
    end

    if index_exists?(:warehouse_folder_document_types, [:warehouse_folder_id, :document_type_id], name: 'idx_warehouse_folder_doc_types_unique')
      rename_index :warehouse_folder_document_types, 'idx_warehouse_folder_doc_types_unique', 'idx_entity_tab_doc_types_unique'
    end

    if index_exists?(:warehouse_folder_document_types, [:document_type_id, :is_primary], name: 'idx_warehouse_folder_doc_types_primary')
      rename_index :warehouse_folder_document_types, 'idx_warehouse_folder_doc_types_primary', 'idx_entity_tab_doc_types_primary'
    end

    # Recreate corporate_entity_tabs (schema only, data not preserved)
    create_table :corporate_entity_tabs do |t|
      t.string :tab_key, null: false
      t.string :display_name, null: false
      t.string :tab_group, default: 'documents'
      t.string :entity_types, array: true, default: []
      t.integer :order_position, default: 0
      t.boolean :enabled, default: true
      t.string :icon_name
      t.text :description
      t.string :component_name
      t.timestamps
      t.boolean :has_storage_folder, default: false
      t.string :storage_folder_path
      t.jsonb :sub_tabs, default: []
      t.references :company_group, foreign_key: true
      t.references :tenant, foreign_key: true
    end
    add_index :corporate_entity_tabs, :enabled
    add_index :corporate_entity_tabs, :order_position
    add_index :corporate_entity_tabs, :tab_group
    add_index :corporate_entity_tabs, :tab_key, unique: true
  end
end
