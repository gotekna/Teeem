class CreateOrganizationOneDriveCredential < ActiveRecord::Migration[8.0]
  def change
    create_table :organization_one_drive_credentials do |t|
      # OAuth tokens
      t.text :access_token
      t.text :refresh_token
      t.datetime :token_expires_at

      # Drive information
      t.string :drive_id
      t.string :drive_name
      t.string :root_folder_id # Root folder for all job folders
      t.string :root_folder_path # Path to root folder (e.g., "TEEEM Jobs")

      # Connection metadata
      t.jsonb :metadata, default: {} # Store additional OneDrive info
      t.boolean :is_active, default: true

      # Audit fields
      t.references :connected_by, foreign_key: { to_table: :users }, null: true
      t.datetime :last_synced_at

      t.timestamps
    end

    # Only one organization credential should exist
    add_index :organization_one_drive_credentials, :is_active, unique: true, where: "is_active = true"
    add_index :organization_one_drive_credentials, :token_expires_at
  end
end
