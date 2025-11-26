class AddXeroTrackingToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :xero_tracking_option_id, :string
    add_column :jobs, :xero_tracking_option_name, :string
    add_column :purchase_orders, :xero_invoice_number, :string unless column_exists?(:purchase_orders, :xero_invoice_number)
  end
end
