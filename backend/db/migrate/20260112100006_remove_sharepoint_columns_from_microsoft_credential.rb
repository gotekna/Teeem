# frozen_string_literal: true

# Phase 5: Remove duplicate SharePoint columns from MicrosoftCredential
#
# These columns are now stored in StorageConfiguration.connection_config:
# - sharepoint_site_id → StorageConfiguration.site_id
# - sharepoint_drive_id → StorageConfiguration.drive_id
# - sharepoint_drive_name → StorageConfiguration.drive_name
# - drive_id → StorageConfiguration.drive_id (duplicate)
# - drive_name → StorageConfiguration.drive_name (duplicate)
#
# SSoT Architecture:
# - MicrosoftCredential → ONLY authentication tokens/secrets
# - StorageConfiguration → ALL connection config (site_id, drive_id, paths, templates)
#
class RemoveSharepointColumnsFromMicrosoftCredential < ActiveRecord::Migration[8.0]
  def up
    # Remove duplicate SharePoint/drive columns
    # These are now in StorageConfiguration.connection_config
    remove_column :microsoft_credentials, :sharepoint_site_id, :string, if_exists: true
    remove_column :microsoft_credentials, :sharepoint_drive_id, :string, if_exists: true
    remove_column :microsoft_credentials, :sharepoint_drive_name, :string, if_exists: true
    remove_column :microsoft_credentials, :drive_id, :string, if_exists: true
    remove_column :microsoft_credentials, :drive_name, :string, if_exists: true

    Rails.logger.info "[Migration] Removed SharePoint columns from MicrosoftCredential"
    Rails.logger.info "[Migration] SSoT: StorageConfiguration.connection_config is now THE ONE source"
  end

  def down
    # Restore columns for rollback (data will be lost)
    add_column :microsoft_credentials, :sharepoint_site_id, :string, unless_exists: true
    add_column :microsoft_credentials, :sharepoint_drive_id, :string, unless_exists: true
    add_column :microsoft_credentials, :sharepoint_drive_name, :string, unless_exists: true
    add_column :microsoft_credentials, :drive_id, :string, unless_exists: true
    add_column :microsoft_credentials, :drive_name, :string, unless_exists: true

    Rails.logger.warn "[Migration] Restored SharePoint columns - DATA WAS NOT RESTORED"
    Rails.logger.warn "[Migration] Run PopulateStorageConfigurationFromCorporateSetting to restore data"
  end
end
