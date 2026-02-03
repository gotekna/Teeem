class AddRootFolderToWarehouseFolders < ActiveRecord::Migration[8.0]
  def up
    add_column :warehouse_folders, :root_folder, :string

    # Populate root_folder from warehouse_folder path template (first segment)
    # e.g., "Jobs/{{JobCode}}/Overview" → "Jobs"
    execute <<-SQL
      UPDATE warehouse_folders
      SET root_folder = split_part(warehouse_folder, '/', 1)
      WHERE warehouse_folder IS NOT NULL AND warehouse_folder != ''
    SQL

    add_index :warehouse_folders, :root_folder
  end

  def down
    remove_index :warehouse_folders, :root_folder
    remove_column :warehouse_folders, :root_folder
  end
end
