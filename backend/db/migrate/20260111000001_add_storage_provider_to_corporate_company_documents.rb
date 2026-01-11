class AddStorageProviderToCorporateCompanyDocuments < ActiveRecord::Migration[7.1]
  def change
    # Add storage provider fields to corporate_company_documents
    # Mirrors the pattern from job_documents for multi-provider support
    add_column :corporate_company_documents, :storage_provider, :string, default: 'sharepoint'
    add_column :corporate_company_documents, :storage_item_id, :string
    add_column :corporate_company_documents, :storage_path, :string
    add_column :corporate_company_documents, :migration_status, :string
    add_column :corporate_company_documents, :migration_started_at, :datetime
    add_column :corporate_company_documents, :migration_completed_at, :datetime
    add_column :corporate_company_documents, :migration_error, :text
    add_column :corporate_company_documents, :source_provider, :string
    add_column :corporate_company_documents, :source_item_id, :string

    # Indexes for efficient querying during migration
    add_index :corporate_company_documents, :storage_provider
    add_index :corporate_company_documents, :migration_status
    add_index :corporate_company_documents, [:storage_provider, :migration_status],
              name: 'idx_corp_docs_provider_migration'
  end
end
