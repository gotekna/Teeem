# frozen_string_literal: true

class CreateGlJournalEntries < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_journal_entries do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :gl_period, null: false, foreign_key: true

      # External provider linking
      t.string :external_provider         # 'xero', 'quickbooks', 'myob', nil
      t.string :external_tenant_id        # Provider's org/company ID

      # Entry Identity
      t.string :entry_number              # "JE-2025-00001" (auto-generated)
      t.date :entry_date, null: false
      t.string :description

      # Source Document (what created this entry)
      t.string :source_type, null: false  # invoice, bill, payment, bank_transaction,
                                          # credit_note, manual_journal, opening_balance
      t.string :source_id                 # Internal ID for TEEEM-created records
      t.string :external_source_id        # Provider's GUID for synced records
      t.string :source_number             # INV-0001, BILL-0042, etc.

      # Totals (must balance: total_debits == total_credits)
      t.decimal :total_debits, precision: 15, scale: 2, default: 0
      t.decimal :total_credits, precision: 15, scale: 2, default: 0

      # Currency (for multi-currency)
      t.string :currency_code, default: 'AUD'
      t.decimal :exchange_rate, precision: 15, scale: 6, default: 1.0

      # Status
      t.string :status, default: 'posted'  # draft, posted, voided
      t.datetime :voided_at
      t.string :void_reason

      # Job linking (optional - for job costing)
      t.references :job, foreign_key: true

      # Audit
      t.datetime :external_created_at
      t.datetime :external_synced_at
      t.references :created_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    # Unique constraint: one entry per source document per provider
    add_index :gl_journal_entries, [:corporate_id, :external_provider, :external_tenant_id, :source_type, :external_source_id],
              unique: true, name: 'idx_gl_journal_entries_unique_external',
              where: 'external_source_id IS NOT NULL'

    # Performance indexes
    add_index :gl_journal_entries, :entry_date
    add_index :gl_journal_entries, :entry_number
    add_index :gl_journal_entries, :source_type
    add_index :gl_journal_entries, :status
    add_index :gl_journal_entries, [:corporate_id, :external_provider, :external_tenant_id, :entry_date],
              name: 'idx_gl_journal_entries_date_lookup'
  end
end
