class AddPurchaseOrderToLabourCostEntries < ActiveRecord::Migration[8.0]
  def change
    add_reference :labour_cost_entries, :purchase_order, null: true, foreign_key: true

    # Add labour budget tracking to purchase orders
    add_column :purchase_orders, :labour_budget, :decimal, precision: 12, scale: 2
    add_column :purchase_orders, :labour_actual, :decimal, precision: 12, scale: 2, default: 0
    add_column :purchase_orders, :is_labour_po, :boolean, default: false
  end
end
