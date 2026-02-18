class AddExternalInvoiceIdToPurchaseOrders < ActiveRecord::Migration[7.2]
  def change
    add_reference :purchase_orders, :external_invoice, foreign_key: { to_table: :external_invoices }, null: true
  end
end
