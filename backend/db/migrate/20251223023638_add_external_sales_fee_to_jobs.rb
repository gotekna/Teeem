class AddExternalSalesFeeToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :external_sales_fee, :decimal, precision: 15, scale: 2
  end
end
