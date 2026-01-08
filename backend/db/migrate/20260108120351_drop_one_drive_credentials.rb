# frozen_string_literal: true

# Drop legacy per-job SharePoint/OneDrive credentials table
# This was a legacy system replaced by MicrosoftCredential (unified SSoT)
# Production had 0 records at time of cleanup (Jan 2026)
class DropOneDriveCredentials < ActiveRecord::Migration[8.0]
  def up
    # Safety check - ensure no data would be lost
    if table_exists?(:one_drive_credentials)
      count = execute("SELECT COUNT(*) FROM one_drive_credentials").first["count"]
      if count.to_i > 0
        raise "Cannot drop one_drive_credentials - table has #{count} records! Migrate data first."
      end

      # Remove foreign key first
      remove_foreign_key :one_drive_credentials, :jobs if foreign_key_exists?(:one_drive_credentials, :jobs)

      drop_table :one_drive_credentials
    end
  end

  def down
    create_table :one_drive_credentials do |t|
      t.references :job, null: false, foreign_key: true, index: { unique: true }
      t.text :access_token
      t.text :refresh_token
      t.datetime :token_expires_at
      t.string :drive_id
      t.string :root_folder_id
      t.string :folder_path
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    add_index :one_drive_credentials, :drive_id
    add_index :one_drive_credentials, :token_expires_at
    add_index :one_drive_credentials, :root_folder_id
  end
end
