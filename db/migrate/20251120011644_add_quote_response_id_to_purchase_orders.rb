class AddQuoteResponseIdToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_reference :purchase_orders, :quote_response, null: true, foreign_key: true
    add_column :purchase_orders, :arrived_at, :datetime
    add_column :purchase_orders, :completed_at, :datetime

    add_index :purchase_orders, :arrived_at
    add_index :purchase_orders, :completed_at
  end
end
