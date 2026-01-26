# frozen_string_literal: true

# LIM Cleanup: Remove dead `paths` column from storage_configurations
#
# The `paths` column was never read - code uses `scope_root_folders` via path_for() instead.
# This migration removes the dead code.
#
# SSoT: StorageConfiguration.scope_root_folders is THE ONE source for scope base paths
class RemoveDeadPathsColumnFromStorageConfigurations < ActiveRecord::Migration[8.0]
  def change
    # The `paths` column is dead code - never referenced in the application
    # StorageConfiguration uses `scope_root_folders` (via path_for()) instead
    remove_column :storage_configurations, :paths, :jsonb, default: {
      "jobs" => "Jobs",
      "tasks" => "Tasks",
      "emails" => "Emails",
      "people" => "People",
      "accounts" => "Accounts",
      "contacts" => "Contacts",
      "corporate" => "Corporate"
    }, null: false
  end
end
