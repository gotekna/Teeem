# Re-adds the link from SmTask to WarehouseFolder (previously photo_entity_tab_id,
# removed in 20251227010022). Renamed to warehouse_folder_id for consistency
# with the WarehouseFolder rename (Feb 2026).
#
# Purpose: Links an SM task to a document folder, enabling the UI to show
# task dates/status when viewing that folder's documents.
class AddWarehouseFolderIdToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :warehouse_folder_id, :bigint
    add_index :sm_tasks, :warehouse_folder_id
  end
end
