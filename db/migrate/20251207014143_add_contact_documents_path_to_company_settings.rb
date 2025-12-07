class AddContactDocumentsPathToCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :company_settings, :contact_documents_path, :string
  end
end
