class RemoveFolderFromWarehouseDocuments < ActiveRecord::Migration[8.0]
  def change
    remove_index :warehouse_documents, :folder, if_exists: true
    remove_column :warehouse_documents, :folder, :string
  end
end
