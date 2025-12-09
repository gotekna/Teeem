class CreateWarehouseBankTransactions < ActiveRecord::Migration[8.0]
  def change
    create_table :warehouse_bank_transactions do |t|
      # Xero identifiers
      t.string :xero_id, null: false
      t.string :tenant_id
      t.string :source, default: "xero"

      # Bank account
      t.string :bank_account_id
      t.string :bank_account_code
      t.string :bank_account_name

      # Transaction details
      t.string :transaction_type  # RECEIVE, SPEND
      t.date :transaction_date, null: false
      t.string :reference
      t.string :status  # AUTHORISED, DELETED, etc.
      t.boolean :is_reconciled, default: false

      # Contact
      t.string :xero_contact_id  # Xero's contact ID
      t.string :contact_name
      t.references :contact, foreign_key: true, null: true  # TEEEM contact FK

      # Amounts
      t.decimal :sub_total, precision: 15, scale: 2
      t.decimal :total_tax, precision: 15, scale: 2
      t.decimal :total, precision: 15, scale: 2
      t.string :currency_code, default: "AUD"

      # Line items (stored as JSON)
      t.jsonb :line_items, default: []

      # Searchable description (concatenated line item descriptions)
      t.text :description

      # Grouping helpers
      t.integer :transaction_month  # 1-12
      t.integer :transaction_year   # 2024, 2025, etc.
      t.string :financial_year      # "FY24", "FY25"

      # Attachments
      t.boolean :has_attachments, default: false

      # Sync tracking
      t.datetime :last_synced_at
      t.datetime :xero_updated_at

      t.timestamps

      t.index :xero_id, unique: true
      t.index :tenant_id
      t.index :bank_account_id
      t.index :transaction_date
      t.index [ :transaction_year, :transaction_month ]
      t.index :financial_year
      t.index :xero_contact_id
    end
  end
end
