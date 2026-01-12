class AddSharepointFolderStatusToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :sharepoint_folder_status, :string, default: "not_requested"
  end
end
