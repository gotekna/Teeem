class AddSharepointPathTypeToEntityTabs < ActiveRecord::Migration[8.0]
  def change
    # SSoT: sharepoint_path_type determines which SharePoint base path to use
    # Values: "corporate" (default) or "contacts"
    # For contact tabs, this lets you choose Corporate or Contacts SharePoint path
    add_column :entity_tabs, :sharepoint_path_type, :string, default: "corporate"

    # Set all existing tabs to use corporate path
    reversible do |dir|
      dir.up do
        execute "UPDATE entity_tabs SET sharepoint_path_type = 'corporate' WHERE sharepoint_path_type IS NULL"
      end
    end
  end
end
