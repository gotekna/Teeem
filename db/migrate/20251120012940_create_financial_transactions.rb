class CreateFinancialTransactions < ActiveRecord::Migration[8.0]
  def change
    create_table :financial_transactions do |t|
      # Core fields
      t.string :transaction_type, null: false  # 'income' or 'expense'
      t.decimal :amount, precision: 10, scale: 2, null: false
      t.date :transaction_date, null: false
      t.text :description
      t.string :category  # Materials, Labour, Job Revenue, etc.
      t.string :status, null: false, default: 'draft'  # 'draft', 'posted', 'synced'

      # Associations
      t.references :construction, foreign_key: true, null: true  # Link to job (optional)
      t.references :user, null: false, foreign_key: true  # Who created the transaction
      t.references :company, null: false, foreign_key: true  # Multi-entity support
      t.references :keepr_journal, foreign_key: { to_table: :keepr_journals }, null: true

      # External system sync
      t.string :external_system_id  # ID in Xero/MYOB/QuickBooks
      t.string :external_system_type  # 'xero', 'myob', 'quickbooks'
      t.datetime :synced_at

      t.timestamps
    end

    # Indexes for common queries
    add_index :financial_transactions, :transaction_type
    add_index :financial_transactions, :transaction_date
    add_index :financial_transactions, :status
    add_index :financial_transactions, :category
    add_index :financial_transactions, [:company_id, :transaction_date]
    add_index :financial_transactions, [:company_id, :status]
    add_index :financial_transactions, [:construction_id, :transaction_date]
    add_index :financial_transactions, [:external_system_type, :external_system_id], name: 'index_fin_trans_on_external_system'
  end
end
