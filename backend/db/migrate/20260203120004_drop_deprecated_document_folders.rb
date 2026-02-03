# SSoT (Feb 2026): Drop deprecated document_folders ecosystem
# Replaced by warehouse_folders + warehouse_folder_document_types (THE ONE SSoT)
#
# Tables dropped:
# - document_folders (15 rows) → replaced by warehouse_folders
# - document_type_folders (61 rows) → replaced by warehouse_folder_document_types
# - xero_feature_tabs.document_folder_id column (0 rows used it)
class DropDeprecatedDocumentFolders < ActiveRecord::Migration[8.0]
  def up
    # 1. Remove FK from xero_feature_tabs
    if foreign_key_exists?(:xero_feature_tabs, :document_folders)
      remove_foreign_key :xero_feature_tabs, :document_folders
    end
    if column_exists?(:xero_feature_tabs, :document_folder_id)
      remove_column :xero_feature_tabs, :document_folder_id
    end

    # 2. Drop document_type_folders junction table (replaced by warehouse_folder_document_types)
    drop_table :document_type_folders, if_exists: true

    # 3. Drop document_folders table
    drop_table :document_folders, if_exists: true
  end

  def down
    # Recreate document_folders
    create_table :document_folders do |t|
      t.string :name, null: false
      t.text :description
      t.integer :order_position, default: 0, null: false
      t.jsonb :entity_types, default: [], null: false
      t.boolean :active, default: true, null: false
      t.timestamps
      t.string :storage_path
      t.integer :parent_id
    end
    add_index :document_folders, :entity_types, using: :gin
    add_index :document_folders, :name, unique: true
    add_index :document_folders, :order_position
    add_index :document_folders, :parent_id

    # Recreate document_type_folders junction
    create_table :document_type_folders do |t|
      t.references :document_type, null: false, foreign_key: true
      t.references :document_folder, null: false, foreign_key: true
      t.boolean :is_primary, default: false, null: false
      t.timestamps
    end
    add_index :document_type_folders, [:document_type_id, :document_folder_id],
              name: 'idx_doc_type_folders_unique', unique: true

    # Recreate xero_feature_tabs column
    add_reference :xero_feature_tabs, :document_folder, foreign_key: true
  end
end
