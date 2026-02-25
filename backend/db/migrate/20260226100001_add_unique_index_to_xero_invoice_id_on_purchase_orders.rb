class AddUniqueIndexToXeroInvoiceIdOnPurchaseOrders < ActiveRecord::Migration[8.0]
  def change
    # Replace non-unique index with unique partial index (NULL xero_invoice_id allowed)
    remove_index :purchase_orders, :xero_invoice_id, name: "index_purchase_orders_on_xero_invoice_id"
    add_index :purchase_orders, :xero_invoice_id, unique: true, where: "xero_invoice_id IS NOT NULL",
              name: "index_purchase_orders_on_xero_invoice_id_unique"
  end
end
