class AddExpectedOnedrivePathToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :expected_onedrive_path, :string
  end
end
