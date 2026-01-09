class RemoveUniqueActiveIndexFromOrgMicrosoftAppCredentials < ActiveRecord::Migration[8.0]
  def change
    # Remove the unique index that only allows ONE active organization
    # We now support MULTIPLE active organizations (Tekna, 100xBestLife, Homes of Hope, Love Your World)
    remove_index :organization_microsoft_app_credentials,
                 name: "index_org_microsoft_app_credentials_on_is_active",
                 if_exists: true
  end
end
