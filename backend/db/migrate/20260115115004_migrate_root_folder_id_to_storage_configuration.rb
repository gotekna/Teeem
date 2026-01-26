# frozen_string_literal: true

# SSoT Migration: Move root_folder_id/root_folder_path from MicrosoftCredential to StorageConfiguration
#
# Why: MicrosoftCredential is for AUTH ONLY (tokens, refresh).
#      StorageConfiguration is the SSoT for all storage config (paths, drive_id, root_folder_id).
#      This completes the SSoT consolidation started in migration 20260112100006.
class MigrateRootFolderIdToStorageConfiguration < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Copy data from MicrosoftCredential to StorageConfiguration
    credential = MicrosoftCredential.find_by(credential_type: "sharepoint")
    config = StorageConfiguration.first

    if credential&.root_folder_id && config
      new_connection_config = (config.connection_config || {}).merge(
        "root_folder_id" => credential.root_folder_id,
        "root_folder_path" => credential.root_folder_path
      )
      config.update_column(:connection_config, new_connection_config)
      Rails.logger.info "[SSoT Migration] Copied root_folder_id=#{credential.root_folder_id} to StorageConfiguration"
    end

    # Step 2: Remove columns from MicrosoftCredential (SSoT cleanup)
    remove_column :microsoft_credentials, :root_folder_id, :string, if_exists: true
    remove_column :microsoft_credentials, :root_folder_path, :string, if_exists: true
  end

  def down
    # Restore columns
    add_column :microsoft_credentials, :root_folder_id, :string
    add_column :microsoft_credentials, :root_folder_path, :string

    # Copy data back
    config = StorageConfiguration.first
    credential = MicrosoftCredential.find_by(credential_type: "sharepoint")

    if config&.connection_config&.dig("root_folder_id") && credential
      credential.update_columns(
        root_folder_id: config.connection_config["root_folder_id"],
        root_folder_path: config.connection_config["root_folder_path"]
      )
    end
  end
end
