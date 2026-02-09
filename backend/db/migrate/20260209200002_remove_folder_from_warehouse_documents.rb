class RemoveFolderFromWarehouseDocuments < ActiveRecord::Migration[8.0]
  def change
    # Drop all indexes that reference the folder column
    remove_index :warehouse_documents, name: :index_warehouse_documents_on_folder, if_exists: true
    remove_index :warehouse_documents, name: :idx_warehouse_docs_scope_folder, if_exists: true
    remove_index :warehouse_documents, name: :idx_warehouse_docs_tenant_scope_folder, if_exists: true

    # Drop the column (folder_path is the SSoT replacement)
    remove_column :warehouse_documents, :folder, :string
  end
end
