class AddUniqueIndexOnNameAndIsActiveToOrganizationMicrosoftAppCredentials < ActiveRecord::Migration[8.0]
  def change
    # Add unique index to prevent duplicate active organizations with the same name
    # This allows multiple organizations (Tekna, 100xBestLife, etc.) but prevents duplicate Teknas
    add_index :organization_microsoft_app_credentials,
              [ :name, :is_active ],
              unique: true,
              where: "is_active = true",
              name: "index_org_microsoft_app_creds_on_name_and_active"
  end
end
