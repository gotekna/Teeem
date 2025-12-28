class AddDocumentProviderToOrganizations < ActiveRecord::Migration[8.0]
  def change
    add_column :organizations, :document_provider, :string, default: 'sharepoint', null: false
    add_column :organizations, :document_provider_credential_id, :bigint
    add_index :organizations, :document_provider
    add_index :organizations, :document_provider_credential_id
  end
end
