class CreateIntercompanyBalances < ActiveRecord::Migration[8.0]
  def change
    create_table :intercompany_balances do |t|
      # The company recording this balance
      t.references :company, null: false, foreign_key: true
      # The related company (counterparty)
      t.references :related_company, null: false, foreign_key: { to_table: :companies }

      # Balance details
      t.string :balance_type, null: false  # loan, receivable, payable, investment
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.string :currency, default: 'AUD'

      # Source of the balance
      t.string :source, null: false  # manual, xero, loan_register, bank_sync
      t.string :source_reference  # e.g., xero_contact_id, loan_id

      # Point in time for the balance
      t.date :as_of_date, null: false

      # Optional description/notes
      t.text :description

      # Metadata for additional info
      t.jsonb :metadata, default: {}

      t.timestamps

      # Indexes
      t.index [ :company_id, :related_company_id, :balance_type, :as_of_date ],
              name: 'idx_intercompany_balances_unique',
              unique: true
      t.index [ :company_id, :as_of_date ]
      t.index [ :related_company_id, :as_of_date ]
      t.index :balance_type
      t.index :source
    end

    # Create reconciliation_reports table to store reconciliation run results
    create_table :reconciliation_reports do |t|
      t.references :company_group, foreign_key: true
      t.date :as_of_date, null: false
      t.string :status, null: false, default: 'pending'  # pending, running, completed, failed
      t.integer :total_pairs_checked, default: 0
      t.integer :matched_pairs, default: 0
      t.integer :mismatched_pairs, default: 0
      t.decimal :total_discrepancy, precision: 15, scale: 2, default: 0
      t.jsonb :summary, default: {}
      t.jsonb :discrepancies, default: []
      t.text :error_message
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps

      t.index [ :company_group_id, :as_of_date ]
      t.index :status
    end
  end
end
