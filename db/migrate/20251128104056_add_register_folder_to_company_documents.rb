class AddRegisterFolderToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :register_folder, :string
  end
end
