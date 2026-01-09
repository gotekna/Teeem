class CreateBillPayments < ActiveRecord::Migration[8.0]
  def change
    create_table :bill_payments do |t|
      t.references :bill_payment_batch, null: false, foreign_key: true
      t.references :bill_inbox, null: false, foreign_key: true
      t.references :purchase_order, foreign_key: true

      t.decimal :amount, precision: 15, scale: 2, null: false
      t.string :status, null: false, default: 'pending'
      # pending, approved, paid, failed, reversed

      # Bank details (for ABA file)
      t.string :payee_name
      t.string :payee_bsb
      t.string :payee_account_number
      t.string :payment_reference, limit: 18  # Max 18 chars for ABA

      # Remittance info
      t.string :remittance_email
      t.boolean :send_remittance, default: true
      t.datetime :remittance_sent_at

      # Xero sync
      t.string :xero_payment_id
      t.datetime :synced_to_xero_at
      t.string :sync_error

      t.timestamps
    end

    add_index :bill_payments, [ :bill_payment_batch_id, :bill_inbox_id ], unique: true, name: 'idx_bill_payments_batch_inbox_unique'
    add_index :bill_payments, :status
  end
end
