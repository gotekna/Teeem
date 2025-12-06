class CreatePayments < ActiveRecord::Migration[8.0]
  def change
    create_table :payments do |t|
      t.references :purchase_order, null: false, foreign_key: true
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.date :payment_date, null: false
      t.string :payment_method # e.g., 'bank_transfer', 'check', 'credit_card', 'cash'
      t.string :reference_number # Transaction reference, check number, etc.
      t.text :notes
      t.string :xero_payment_id, index: true
      t.datetime :xero_synced_at
      t.text :xero_sync_error
      t.references :created_by, foreign_key: { to_table: :users }, null: true

      t.timestamps
    end

    add_index :payments, :payment_date
    add_index :payments, [ :purchase_order_id, :payment_date ]
  end
end
