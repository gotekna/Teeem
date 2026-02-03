# frozen_string_literal: true

# Re-add folder column to warehouse_documents
# This column was removed but controller SQL queries still reference it
# The folder value is computed from source_type → root folder mapping
class AddFolderToWarehouseDocuments < ActiveRecord::Migration[8.0]
  def up
    # Add the column
    add_column :warehouse_documents, :folder, :string

    # Add index for folder queries (used extensively in documents_controller)
    add_index :warehouse_documents, :folder, name: "idx_warehouse_docs_folder"

    # Populate folder values based on source_type mapping
    # This matches the WarehouseDocument#folder method logic
    execute <<-SQL
      UPDATE warehouse_documents
      SET folder = CASE source_type
        WHEN 'corporate' THEN 'Corporate'
        WHEN 'xero' THEN 'Corporate'
        WHEN 'financial' THEN 'Corporate'
        WHEN 'asset' THEN 'Corporate'
        WHEN 'job' THEN 'Jobs'
        WHEN 'compliance' THEN 'Jobs'
        WHEN 'contact' THEN 'Contacts'
        WHEN 'people' THEN 'Contacts'
        WHEN 'task' THEN 'Tasks'
        WHEN 'email' THEN 'Emails'
        WHEN 'email_attachment' THEN 'Emails'
        WHEN 'case' THEN 'Cases'
        WHEN 'user' THEN 'Teeem Docs'
        WHEN 'template' THEN 'Warehousing'
        WHEN 'warehouse' THEN 'Warehousing'
        WHEN 'esignature' THEN 'Warehousing'
        ELSE COALESCE(INITCAP(source_type), 'Documents')
      END
      WHERE folder IS NULL OR folder = ''
    SQL
  end

  def down
    remove_index :warehouse_documents, name: "idx_warehouse_docs_folder", if_exists: true
    remove_column :warehouse_documents, :folder
  end
end
