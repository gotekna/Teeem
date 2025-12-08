class AddNameToMicrosoftCredentialsAndRemoveSingletonConstraints < ActiveRecord::Migration[8.0]
  def change
    # Add name column to identify each Microsoft organization
    add_column :organization_microsoft_app_credentials, :name, :string
    add_column :organization_one_drive_credentials, :name, :string
    add_column :organization_outlook_credentials, :name, :string

    # Remove unique constraint on is_active (allows multiple active orgs)
    # organization_microsoft_app_credentials - use full index name as created by Rails
    remove_index :organization_microsoft_app_credentials,
                 name: "index_organization_microsoft_app_credentials_on_is_active",
                 if_exists: true

    # organization_one_drive_credentials
    remove_index :organization_one_drive_credentials,
                 name: "index_organization_one_drive_credentials_on_is_active",
                 if_exists: true

    # Add regular (non-unique) index for filtering active credentials
    add_index :organization_microsoft_app_credentials, :is_active,
              name: "index_org_ms_app_creds_on_is_active"
    add_index :organization_one_drive_credentials, :is_active,
              name: "index_org_onedrive_creds_on_is_active"

    # Add index on name for lookups
    add_index :organization_microsoft_app_credentials, :name,
              name: "index_org_ms_app_creds_on_name"
    add_index :organization_one_drive_credentials, :name,
              name: "index_org_onedrive_creds_on_name"
    add_index :organization_outlook_credentials, :name,
              name: "index_org_outlook_creds_on_name"

    # Update existing records to have a default name
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE organization_microsoft_app_credentials
          SET name = 'Tekna'
          WHERE name IS NULL;
        SQL

        execute <<-SQL
          UPDATE organization_one_drive_credentials
          SET name = 'Tekna'
          WHERE name IS NULL;
        SQL

        execute <<-SQL
          UPDATE organization_outlook_credentials
          SET name = 'Tekna'
          WHERE name IS NULL;
        SQL
      end
    end
  end
end
