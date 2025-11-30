class AddOnedriveFolderToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :onedrive_folder_id, :string
    add_column :companies, :onedrive_folder_path, :string
  end
end
