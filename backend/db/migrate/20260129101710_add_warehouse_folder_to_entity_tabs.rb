class AddWarehouseFolderToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :entity_tabs, :warehouse_folder, :string
  end
end
