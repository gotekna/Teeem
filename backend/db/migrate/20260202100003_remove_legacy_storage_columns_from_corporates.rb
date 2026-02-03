class RemoveLegacyStorageColumnsFromCorporates < ActiveRecord::Migration[8.0]
  def change
    # SSoT Cleanup: These columns are legacy - SharePoint URL is now computed
    # dynamically via Corporate#sharepoint_folder_url method which uses:
    # - MicrosoftCredential.sharepoint_credential (for site_web_url)
    # - WarehouseProvider.instance (for path configuration)
    remove_column :corporates, :storage_folder_id, :string
    remove_column :corporates, :storage_folder_path, :string
    remove_column :corporates, :storage_folder_url, :string
    remove_column :corporates, :storage_folder_name, :string
  end
end
