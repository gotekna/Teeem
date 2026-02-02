# frozen_string_literal: true

class CreateGlOpeningBalances < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_opening_balances do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :gl_account, null: false, foreign_key: true

      # External provider linking
      t.string :external_provider         # 'xero', 'quickbooks', 'myob', nil
      t.string :external_tenant_id        # Provider's org/company ID

      # Opening Balance
      t.date :effective_date, null: false  # Usually July 1 of first FY, or conversion date
      t.decimal :balance, precision: 15, scale: 2, default: 0

      # Source tracking
      t.string :source                     # 'xero_sync', 'manual', 'migration', 'year_end_rollover'
      t.string :financial_year             # "FY2025"

      # For bank accounts, track the last reconciled balance
      t.decimal :reconciled_balance, precision: 15, scale: 2
      t.date :reconciled_date

      t.timestamps
    end

    # Unique constraint: one opening balance per account per effective date
    add_index :gl_opening_balances, [:gl_account_id, :effective_date], unique: true

    # Performance indexes
    add_index :gl_opening_balances, :financial_year
    add_index :gl_opening_balances, :effective_date
  end
end
