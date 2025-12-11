class AddApTrackingToPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    add_column :purchase_orders, :total_billed, :decimal, precision: 15, scale: 2, default: 0
    add_column :purchase_orders, :total_paid_via_ap, :decimal, precision: 15, scale: 2, default: 0
    add_column :purchase_orders, :remaining_to_pay, :decimal, precision: 15, scale: 2, default: 0
    add_column :purchase_orders, :last_bill_inbox_id, :bigint

    add_foreign_key :purchase_orders, :bill_inboxes, column: :last_bill_inbox_id
  end
end
