class AddSharepointEmailFileIdToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouses, :sharepoint_email_file_id, :string
    add_column :email_warehouses, :sharepoint_email_path, :string

    add_index :email_warehouses, :sharepoint_email_file_id
  end
end
