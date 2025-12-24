# frozen_string_literal: true

class CreateGlAccountBalances < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_account_balances do |t|
      t.references :gl_account, null: false, foreign_key: true
      t.references :gl_period, null: false, foreign_key: true

      # Balances
      t.decimal :opening_balance, precision: 15, scale: 2, default: 0
      t.decimal :period_debits, precision: 15, scale: 2, default: 0
      t.decimal :period_credits, precision: 15, scale: 2, default: 0
      t.decimal :closing_balance, precision: 15, scale: 2, default: 0

      # Movement = period_debits - period_credits (or vice versa depending on account type)
      t.decimal :net_movement, precision: 15, scale: 2, default: 0

      # Year to Date
      t.decimal :ytd_debits, precision: 15, scale: 2, default: 0
      t.decimal :ytd_credits, precision: 15, scale: 2, default: 0
      t.decimal :ytd_balance, precision: 15, scale: 2, default: 0

      # Calculation metadata
      t.datetime :calculated_at
      t.integer :transaction_count, default: 0

      t.timestamps
    end

    # Unique constraint: one balance per account per period
    add_index :gl_account_balances, [:gl_account_id, :gl_period_id], unique: true

    # Performance indexes for reports
    add_index :gl_account_balances, :calculated_at
  end
end
