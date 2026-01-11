class AddStorageProviderToPeopleDocuments < ActiveRecord::Migration[7.1]
  def change
    # Add storage provider fields to people_documents
    # Mirrors the pattern from job_documents for multi-provider support
    add_column :people_documents, :storage_provider, :string, default: 'sharepoint'
    add_column :people_documents, :storage_item_id, :string
    add_column :people_documents, :storage_path, :string
    add_column :people_documents, :migration_status, :string
    add_column :people_documents, :migration_started_at, :datetime
    add_column :people_documents, :migration_completed_at, :datetime
    add_column :people_documents, :migration_error, :text
    add_column :people_documents, :source_provider, :string
    add_column :people_documents, :source_item_id, :string

    # Indexes for efficient querying during migration
    add_index :people_documents, :storage_provider
    add_index :people_documents, :migration_status
    add_index :people_documents, [:storage_provider, :migration_status],
              name: 'idx_people_docs_provider_migration'
  end
end
