# frozen_string_literal: true

class CreateGlLedgerLines < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_ledger_lines do |t|
      t.references :gl_journal_entry, null: false, foreign_key: true
      t.references :gl_account, null: false, foreign_key: true

      # The posting (one of debit/credit should be > 0, not both)
      t.decimal :debit, precision: 15, scale: 2, default: 0
      t.decimal :credit, precision: 15, scale: 2, default: 0

      # Description (line-level detail)
      t.string :description
      t.string :reference                  # Contact name, invoice number, etc.

      # Tax
      t.string :tax_type
      t.decimal :tax_amount, precision: 15, scale: 2, default: 0

      # Tracking categories (for departmental reporting)
      t.string :tracking_category_1
      t.string :tracking_option_1
      t.string :tracking_category_2
      t.string :tracking_option_2

      # Job linking (for job costing - can be different per line)
      t.references :job, foreign_key: true, index: false

      # Contact linking (for AR/AP reports)
      t.references :contact, foreign_key: true, index: false

      # Running balance (calculated for bank accounts)
      t.decimal :running_balance, precision: 15, scale: 2

      # Line order within journal entry
      t.integer :line_number

      t.timestamps
    end

    # Performance indexes
    add_index :gl_ledger_lines, [:gl_account_id, :created_at]
    add_index :gl_ledger_lines, :job_id, where: 'job_id IS NOT NULL'
    add_index :gl_ledger_lines, :contact_id, where: 'contact_id IS NOT NULL'
  end
end
