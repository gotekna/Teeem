# SSoT (Feb 2026): Drop warehouse_document_folder_backup table
# This was created during migration to remove folder column from warehouse_documents
# The folder column has been deleted - WarehouseFolder is THE ONE SSoT
# 134743 rows of backup data no longer needed
class DropWarehouseDocumentFolderBackup < ActiveRecord::Migration[8.0]
  def up
    drop_table :warehouse_document_folder_backup, if_exists: true
  end

  def down
    # Note: Data cannot be restored, only schema
    create_table :warehouse_document_folder_backup, id: false do |t|
      t.bigint :id
      t.string :folder
      t.string :source_type
      t.string :documentable_type
      t.bigint :documentable_id
      t.datetime :created_at
    end
  end
end
