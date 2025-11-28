class AddRegisterFieldsToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :folder, :string
    add_column :company_documents, :storage_type, :string  # manual, electronic, both
    add_column :company_documents, :filed_by, :string
    add_reference :company_documents, :document_type, foreign_key: true

    add_index :company_documents, :folder
    add_index :company_documents, :storage_type
  end
end
