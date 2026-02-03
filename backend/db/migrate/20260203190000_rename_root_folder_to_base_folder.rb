# frozen_string_literal: true

# SSoT (Feb 2026): Rename root_folder to base_folder
# UI calls this "Base Folder" - aligning DB column name with UI terminology
class RenameRootFolderToBaseFolder < ActiveRecord::Migration[7.0]
  def change
    rename_column :warehouse_folders, :root_folder, :base_folder
  end
end
