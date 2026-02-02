class AddSharepointTasksPathToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_settings, :sharepoint_tasks_path, :string
  end
end
