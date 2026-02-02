# frozen_string_literal: true

class CreateGlBankReconciliations < ActiveRecord::Migration[8.0]
  def change
    # ═══════════════════════════════════════════════════════════════
    # GL BANK RECONCILIATIONS - Track reconciliation sessions
    # ═══════════════════════════════════════════════════════════════
    create_table :gl_bank_reconciliations do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :gl_account, null: false, foreign_key: true  # Bank account

      # External provider linking
      t.string :external_provider
      t.string :external_tenant_id

      # Reconciliation period
      t.date :statement_date, null: false
      t.date :period_start
      t.date :period_end

      # Statement balances
      t.decimal :statement_opening_balance, precision: 15, scale: 2
      t.decimal :statement_closing_balance, precision: 15, scale: 2, null: false

      # Calculated balances
      t.decimal :gl_opening_balance, precision: 15, scale: 2
      t.decimal :gl_closing_balance, precision: 15, scale: 2
      t.decimal :reconciled_balance, precision: 15, scale: 2
      t.decimal :difference, precision: 15, scale: 2, default: 0

      # Status
      t.string :status, default: 'in_progress'  # in_progress, completed, locked
      t.datetime :completed_at
      t.references :completed_by, foreign_key: { to_table: :users }

      # Stats
      t.integer :matched_count, default: 0
      t.integer :unmatched_count, default: 0
      t.integer :adjustment_count, default: 0

      t.text :notes

      t.timestamps

      t.index [ :gl_account_id, :statement_date ], unique: true, name: 'idx_gl_recon_account_date'
      t.index [ :corporate_id, :status ], name: 'idx_gl_recon_company_status'
    end

    # ═══════════════════════════════════════════════════════════════
    # GL RECONCILIATION LINES - Individual matched/unmatched items
    # ═══════════════════════════════════════════════════════════════
    create_table :gl_reconciliation_lines do |t|
      t.references :gl_bank_reconciliation, null: false, foreign_key: true

      # The GL transaction (journal entry line for this bank account)
      t.references :gl_ledger_line, foreign_key: true

      # External bank feed transaction (if importing from statement)
      t.string :external_transaction_id
      t.date :transaction_date
      t.string :description
      t.decimal :amount, precision: 15, scale: 2
      t.string :reference

      # Match status
      t.string :status, default: 'unmatched'  # unmatched, matched, excluded, adjustment
      t.string :match_type                     # auto, manual, rule
      t.decimal :match_confidence, precision: 5, scale: 2  # 0-100%

      # For adjustments
      t.references :gl_account, foreign_key: true  # Account to adjust
      t.text :adjustment_reason

      # Linked items (for split matches)
      t.jsonb :matched_transaction_ids, default: []

      t.timestamps

      t.index [ :gl_bank_reconciliation_id, :status ], name: 'idx_gl_recon_lines_status'
      t.index :external_transaction_id, name: 'idx_gl_recon_lines_external'
    end

    # ═══════════════════════════════════════════════════════════════
    # GL RECONCILIATION RULES - Auto-matching rules
    # ═══════════════════════════════════════════════════════════════
    create_table :gl_reconciliation_rules do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :gl_account, foreign_key: true  # Specific bank account or null for all

      # Rule definition
      t.string :name, null: false
      t.string :rule_type, null: false  # description_contains, amount_equals, reference_matches
      t.string :match_field              # description, reference, amount
      t.string :match_operator           # contains, equals, starts_with, ends_with, regex
      t.string :match_value
      t.decimal :amount_tolerance, precision: 15, scale: 2, default: 0  # For fuzzy amount matching

      # Action when matched
      t.references :target_account, foreign_key: { to_table: :gl_accounts }
      t.string :tax_type
      t.text :default_description

      # Stats
      t.integer :times_used, default: 0
      t.datetime :last_used_at

      # Status
      t.boolean :active, default: true
      t.integer :priority, default: 0  # Higher = checked first

      t.timestamps

      t.index [ :corporate_id, :active, :priority ], name: 'idx_gl_recon_rules_active'
    end
  end
end
