class AddExternalIdToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :external_id, :string
    add_index :company_documents, :external_id
  end
end
