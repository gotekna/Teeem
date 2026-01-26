# frozen_string_literal: true

class AddUserToWarehouseRootFolders < ActiveRecord::Migration[8.0]
  def up
    # Add 'user' scope to warehouse_root_folders for Teeem Docs feature
    # SSoT: StorageConfiguration.warehouse_root_folders stores all scope paths
    execute <<~SQL
      UPDATE storage_configurations
      SET warehouse_root_folders = warehouse_root_folders || '{"user": "Teeem Docs/{{UserName}}/{{Folder}}"}'::jsonb
    SQL
  end

  def down
    execute <<~SQL
      UPDATE storage_configurations
      SET warehouse_root_folders = warehouse_root_folders - 'user'
    SQL
  end
end
