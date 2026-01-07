class AddDismissedJobIdsToEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    add_column :email_warehouses, :dismissed_from_job_ids, :integer, array: true, default: []
  end
end
