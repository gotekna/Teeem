# Rename warehouse_folder column to folder_path for clarity
# The column stores path templates like "Cases/{{CaseId}}", "Jobs/{{JobCode}}/Overview"
# Having a column named warehouse_folder on a table named warehouse_folders was confusing
class RenameWarehouseFolderToFolderPath < ActiveRecord::Migration[7.0]
  def change
    rename_column :warehouse_folders, :warehouse_folder, :folder_path
  end
end
