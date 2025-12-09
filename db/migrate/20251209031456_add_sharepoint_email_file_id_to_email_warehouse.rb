class AddSharepointEmailFileIdToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouse, :sharepoint_email_file_id, :string unless column_exists?(:email_warehouse, :sharepoint_email_file_id)
    add_column :email_warehouse, :sharepoint_email_path, :string unless column_exists?(:email_warehouse, :sharepoint_email_path)

    add_index :email_warehouse, :sharepoint_email_file_id unless index_exists?(:email_warehouse, :sharepoint_email_file_id)
  end
end
