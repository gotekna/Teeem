# frozen_string_literal: true

# Create ContactDocument table for contact-related document storage
#
# SSoT: ContactDocument uses StorableDocument concern to integrate with
# the storage system. Storage path: /Contacts/{{ContactName}}/{{TabName}}/
#
class CreateContactDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_documents do |t|
      t.references :contact, null: false, foreign_key: true
      t.references :document_type, foreign_key: true
      t.references :uploaded_by, foreign_key: { to_table: :users }

      t.string :file_name, null: false
      t.string :file_extension, limit: 10
      t.integer :file_size
      t.string :content_type
      t.string :folder  # Tab name from EntityTab

      # Storage columns (same pattern as other document models)
      t.string :storage_path
      t.string :storage_item_id
      t.string :storage_provider, limit: 20

      # Legacy SharePoint (for migration from existing systems)
      t.string :sharepoint_item_id
      t.string :sharepoint_file_id
      t.string :web_url

      # Migration tracking
      t.string :migration_status, limit: 20
      t.text :migration_error
      t.datetime :migration_started_at
      t.datetime :migration_completed_at

      t.timestamps
    end

    add_index :contact_documents, :storage_provider
    add_index :contact_documents, :migration_status
    add_index :contact_documents, :folder
  end
end
