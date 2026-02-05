class AddFolderPathTemplateToWarehouseTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :warehouse_types, :folder_path_template, :string
  end
end
