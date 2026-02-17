class AddCreditAmountToPurchaseOrders < ActiveRecord::Migration[7.2]
  def change
    add_column :purchase_orders, :credit_amount, :decimal, precision: 15, scale: 2, default: 0.0
  end
end
