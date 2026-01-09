class AddSharePointFieldsToCorporateEntityTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_entity_tabs, :has_sharepoint_folder, :boolean, default: false
    add_column :corporate_entity_tabs, :sharepoint_folder_path, :string
    add_column :corporate_entity_tabs, :sub_tabs, :jsonb, default: []
  end
end
