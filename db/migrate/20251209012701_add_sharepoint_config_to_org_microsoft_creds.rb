class AddSharepointConfigToOrgMicrosoftCreds < ActiveRecord::Migration[8.0]
  def change
    add_column :organization_microsoft_app_credentials, :sharepoint_site_id, :string
    add_column :organization_microsoft_app_credentials, :sharepoint_drive_id, :string
    add_column :organization_microsoft_app_credentials, :sharepoint_drive_name, :string

    add_index :organization_microsoft_app_credentials, :sharepoint_site_id
    add_index :organization_microsoft_app_credentials, :sharepoint_drive_id
  end
end
