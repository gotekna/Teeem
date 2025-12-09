class AddParentIdToDocumentFolders < ActiveRecord::Migration[8.0]
  def change
    add_column :document_folders, :parent_id, :integer
    add_index :document_folders, :parent_id
    add_foreign_key :document_folders, :document_folders, column: :parent_id
  end
end
