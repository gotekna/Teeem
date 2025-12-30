class AddSharepointFolderIds < ActiveRecord::Migration[8.0]
  def change
    # Add sharepoint_folder_id to jobs table
    # Stores the Microsoft Graph item ID for the job's SharePoint folder
    # This allows finding folders by ID instead of name matching (more reliable)
    add_column :jobs, :sharepoint_folder_id, :string
    add_index :jobs, :sharepoint_folder_id

    # Add sharepoint_folder_id to entity_tabs table
    # Stores the Microsoft Graph item ID for corporate/people/contact folders
    # Enables folder rename flow for ALL scopes (not just jobs)
    add_column :entity_tabs, :sharepoint_folder_id, :string
    add_index :entity_tabs, :sharepoint_folder_id
  end
end
