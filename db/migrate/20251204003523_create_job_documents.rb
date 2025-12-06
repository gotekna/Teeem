class CreateJobDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :job_documents do |t|
      t.references :job, null: false, foreign_key: true
      t.references :document_type, foreign_key: true

      # OneDrive reference
      t.string :onedrive_item_id, null: false
      t.string :onedrive_drive_id

      # File metadata
      t.string :file_name, null: false
      t.string :file_extension
      t.string :file_type
      t.bigint :file_size
      t.string :folder_path
      t.string :web_url
      t.string :thumbnail_url

      # Version tracking
      t.string :version_id
      t.datetime :last_modified_at
      t.string :last_modified_by

      # Sync status
      t.string :sync_status, default: 'synced'
      t.datetime :last_synced_at

      # CAD-specific metadata (extracted from files)
      t.jsonb :cad_metadata, default: {}

      t.timestamps
    end

    add_index :job_documents, :onedrive_item_id, unique: true
    add_index :job_documents, [ :job_id, :folder_path ]
    add_index :job_documents, [ :job_id, :file_type ]
    add_index :job_documents, :file_type
    add_index :job_documents, :sync_status
  end
end
