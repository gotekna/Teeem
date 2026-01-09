class AddDueDateToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :due_date, :date
  end
end
