class AddMimeTypeToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :mime_type, :string
  end
end
