class CreateSubcontractorInvoices < ActiveRecord::Migration[8.0]
  def change
    create_table :subcontractor_invoices do |t|
      t.references :purchase_order, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :accounting_integration, null: true, foreign_key: true
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.string :external_invoice_id
      t.string :status, null: false, default: 'draft'
      t.datetime :synced_at
      t.datetime :paid_at
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :subcontractor_invoices, :status
    add_index :subcontractor_invoices, :external_invoice_id
    add_index :subcontractor_invoices, [:purchase_order_id, :status]
    add_index :subcontractor_invoices, [:contact_id, :status]
    add_index :subcontractor_invoices, :paid_at
  end
end
