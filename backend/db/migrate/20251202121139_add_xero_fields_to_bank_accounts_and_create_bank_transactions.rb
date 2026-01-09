class AddXeroFieldsToBankAccountsAndCreateBankTransactions < ActiveRecord::Migration[8.0]
  def change
    # Add Xero account ID to bank_accounts for linking
    add_column :bank_accounts, :xero_account_id, :string
    add_index :bank_accounts, :xero_account_id

    # Create bank_transactions table for synced Xero transactions
    create_table :bank_transactions do |t|
      t.references :company, null: false, foreign_key: true
      t.references :bank_account, foreign_key: true
      t.string :xero_transaction_id, null: false
      t.string :transaction_type  # SPEND, RECEIVE, TRANSFER
      t.date :transaction_date, null: false
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.string :reference
      t.text :description
      t.string :contact_name
      t.string :xero_contact_id
      t.string :status  # AUTHORISED, DELETED
      t.string :line_amount_types  # Exclusive, Inclusive, NoTax
      t.boolean :is_reconciled, default: false
      t.string :currency_code, default: 'AUD'
      t.jsonb :metadata, default: {}
      t.timestamps

      t.index :xero_transaction_id, unique: true
      t.index [ :company_id, :transaction_date ]
      t.index [ :bank_account_id, :transaction_date ]
      t.index :status
    end
  end
end
