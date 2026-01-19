# SSoT: Remove scope_folders column - EntityTab is now THE ONE source of truth
#
# Before: scope_folders JSONB stored folder paths in StorageConfiguration
# After:  EntityTab.scope_base_folders is the SSoT for all storage folder paths
#
# Migration is IRREVERSIBLE - the data is fully migrated to EntityTab
# See: EntityTab.seed_legacy_storage_tabs! for the migrated data
#
class RemoveScopeFoldersFromStorageConfigurations < ActiveRecord::Migration[8.0]
  def up
    remove_column :storage_configurations, :scope_folders
  end

  def down
    # Add column back (but data is lost - must re-seed from EntityTab if needed)
    add_column :storage_configurations, :scope_folders, :jsonb, default: {}

    # Note: To restore data, run:
    # StorageConfiguration.instance.update!(scope_folders: EntityTab.scope_base_folders)
  end
end
