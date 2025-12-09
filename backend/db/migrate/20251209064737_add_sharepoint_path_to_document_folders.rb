class AddSharepointPathToDocumentFolders < ActiveRecord::Migration[8.0]
  def change
    add_column :document_folders, :sharepoint_path, :string
  end
end
