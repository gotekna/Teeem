class AddStorageProviderToJobDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :job_documents, :storage_provider, :string, default: 'sharepoint'
    add_column :job_documents, :storage_item_id, :string
    add_column :job_documents, :storage_path, :string

    add_index :job_documents, :storage_provider
    add_index :job_documents, [:storage_provider, :storage_item_id]

    # Backfill existing records with SharePoint data
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE job_documents
          SET storage_item_id = sharepoint_item_id,
              storage_provider = 'sharepoint'
          WHERE sharepoint_item_id IS NOT NULL
        SQL
      end
    end
  end
end
