class AddOnedriveFieldsToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :onedrive_file_id, :string
    add_column :company_documents, :onedrive_download_url, :string
    add_column :company_documents, :last_modified_at, :datetime

    add_index :company_documents, :onedrive_file_id, unique: true, where: "onedrive_file_id IS NOT NULL"
  end
end
