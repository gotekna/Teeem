class CreateDividendPayments < ActiveRecord::Migration[8.0]
  def change
    create_table :dividend_payments do |t|
      t.references :dividend, null: false, foreign_key: true
      t.references :shareholder, null: false, foreign_key: { to_table: :contacts }
      t.integer :shares_held  # At record date
      t.decimal :gross_amount, precision: 12, scale: 2
      t.decimal :franking_credit, precision: 12, scale: 2
      t.decimal :net_amount, precision: 12, scale: 2
      t.date :paid_date
      t.string :payment_method  # bank_transfer, cheque

      t.timestamps
    end
    add_index :dividend_payments, [ :dividend_id, :shareholder_id ], unique: true
    add_index :dividend_payments, :paid_date
  end
end
