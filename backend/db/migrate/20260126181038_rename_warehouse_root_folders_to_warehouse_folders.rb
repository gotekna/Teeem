class RenameWarehouseRootFoldersToWarehouseFolders < ActiveRecord::Migration[8.0]
  def change
    rename_column :storage_configurations, :warehouse_root_folders, :warehouse_folders
  end
end
