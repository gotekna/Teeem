class AddUniqueIndexToOrganizationMicrosoftAppCredentials < ActiveRecord::Migration[8.0]
  def change
    # Add partial unique index to prevent duplicate active organizations with the same name
    # Allows multiple inactive records with the same name (for history)
    # but only ONE active record per organization name
    add_index :organization_microsoft_app_credentials,
              :name,
              unique: true,
              where: "is_active = true",
              name: "index_org_microsoft_app_credentials_on_name_active"
  end
end
