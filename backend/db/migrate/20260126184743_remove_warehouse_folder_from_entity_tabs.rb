# frozen_string_literal: true

# SSoT Cleanup: Remove duplicate warehouse_folder column from EntityTabs
#
# This column was storing folder paths per-tab, but this duplicated
# StorageConfiguration.warehouse_folders which is THE ONE SSoT for all folder templates.
#
# Now: Folder paths are derived at runtime using:
#   template = StorageConfiguration.warehouse_folders[warehouse_type]
#   folder = template.gsub('{{TabName}}', tab.display_name)
#
# See: EntityTabQueryService#derive_warehouse_folder
# See: StorageLocation#derived_warehouse_folder
#
class RemoveWarehouseFolderFromEntityTabs < ActiveRecord::Migration[8.0]
  def change
    remove_column :entity_tabs, :warehouse_folder, :string
  end
end
