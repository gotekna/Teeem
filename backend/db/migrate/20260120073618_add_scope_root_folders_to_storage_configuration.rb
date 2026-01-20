# frozen_string_literal: true

# Add scope_root_folders to StorageConfiguration
#
# SSoT: This is THE ONE place to configure root folders for each scope.
# Individual EntityTab paths are relative to these roots.
#
# Example:
#   {
#     "job" => "Jobs",
#     "contact" => "Contacts",
#     "corporate_entity" => "Corporate",
#     "people" => "People",
#     "task" => "Tasks",
#     "email" => "Emails",
#     "warehouse" => "Warehousing"
#   }
class AddScopeRootFoldersToStorageConfiguration < ActiveRecord::Migration[7.1]
  def change
    add_column :storage_configurations, :scope_root_folders, :jsonb, default: {}, null: false

    reversible do |dir|
      dir.up do
        # Seed with default values from EntityTab overview tabs
        execute <<-SQL
          UPDATE storage_configurations
          SET scope_root_folders = '{
            "job": "Jobs",
            "contact": "Contacts",
            "corporate_entity": "Corporate",
            "people": "People",
            "task": "Tasks",
            "email": "Emails",
            "warehouse": "Warehousing"
          }'::jsonb
        SQL
      end
    end
  end
end
