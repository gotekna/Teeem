class AddSharepointUrlToDocumentTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :document_tasks, :sharepoint_url, :string
  end
end
