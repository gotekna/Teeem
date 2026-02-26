class AddUniqueIndexToXeroInvoiceIdOnPurchaseOrders < ActiveRecord::Migration[8.0]
  def up
    # Clean up any duplicate xero_invoice_ids before creating unique index
    execute <<~SQL
      DELETE FROM purchase_order_line_items
      WHERE purchase_order_id IN (
        SELECT id FROM purchase_orders
        WHERE id NOT IN (
          SELECT MIN(id) FROM purchase_orders
          WHERE xero_invoice_id IS NOT NULL
          GROUP BY xero_invoice_id
        )
        AND xero_invoice_id IS NOT NULL
      )
    SQL

    execute <<~SQL
      DELETE FROM purchase_orders
      WHERE xero_invoice_id IS NOT NULL
      AND id NOT IN (
        SELECT MIN(id) FROM purchase_orders
        WHERE xero_invoice_id IS NOT NULL
        GROUP BY xero_invoice_id
      )
    SQL

    # Remove old non-unique index (if it still exists from a previous failed run)
    remove_index :purchase_orders, name: "index_purchase_orders_on_xero_invoice_id", if_exists: true

    # Create unique partial index (NULL xero_invoice_id allowed)
    add_index :purchase_orders, :xero_invoice_id, unique: true, where: "xero_invoice_id IS NOT NULL",
              name: "index_purchase_orders_on_xero_invoice_id_unique", if_not_exists: true
  end

  def down
    remove_index :purchase_orders, name: "index_purchase_orders_on_xero_invoice_id_unique", if_exists: true
    add_index :purchase_orders, :xero_invoice_id, name: "index_purchase_orders_on_xero_invoice_id", if_not_exists: true
  end
end
