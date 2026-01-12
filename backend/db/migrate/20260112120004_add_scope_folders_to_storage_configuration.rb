# frozen_string_literal: true

# Add scope_folders to StorageConfiguration
# SSoT: Replaces hardcoded SCOPE_FOLDERS constant with database-configurable mapping
class AddScopeFoldersToStorageConfiguration < ActiveRecord::Migration[8.0]
  def up
    add_column :storage_configurations, :scope_folders, :jsonb, default: {}, null: false

    # Populate existing records with default scope folders
    default_folders = {
      "job" => "Jobs",
      "corporate" => "Corporate",
      "people" => "Corporate/People",
      "contact" => "Contacts",
      "email" => "Emails/eml",
      "warehouse" => "Warehousing",
      "task" => "Tasks",
      "attachments" => "Emails/attachments"
    }

    StorageConfiguration.update_all(scope_folders: default_folders)
  end

  def down
    remove_column :storage_configurations, :scope_folders
  end
end
