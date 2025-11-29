class AddSharepointFolderUrlToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :sharepoint_folder_url, :string
  end
end
