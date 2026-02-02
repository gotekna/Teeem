# frozen_string_literal: true

class CreateGlAccounts < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_accounts do |t|
      t.references :corporate, null: false, foreign_key: true

      # External provider linking (nullable - works for any provider)
      t.string :external_provider       # 'xero', 'quickbooks', 'myob', nil (standalone)
      t.string :external_tenant_id      # Provider's org/company ID
      t.string :external_account_id     # Provider's account ID (e.g., Xero's GUID)
      t.datetime :external_synced_at

      # Account Identity
      t.string :code, null: false       # "1000", "2100", "4000"
      t.string :name, null: false       # "NAB Business Account"
      t.string :description

      # Classification
      t.string :account_type, null: false  # asset, liability, equity, revenue, expense
      t.string :account_class              # current_asset, fixed_asset, current_liability, etc.
      t.string :system_account             # accounts_receivable, accounts_payable, bank, etc.

      # Tax
      t.string :tax_type                   # GST on Income, GST on Expenses, BAS Excluded

      # Status
      t.boolean :is_bank_account, default: false
      t.boolean :is_system_account, default: false  # Cannot be deleted
      t.boolean :active, default: true
      t.boolean :show_in_expense_claims, default: false

      # Hierarchy (for sub-accounts)
      t.references :parent_account, foreign_key: { to_table: :gl_accounts }
      t.integer :display_order

      # Currency (for bank accounts)
      t.string :currency_code, default: 'AUD'

      t.timestamps
    end

    # Unique constraint: one account code per company per provider tenant
    add_index :gl_accounts, [:corporate_id, :external_provider, :external_tenant_id, :code],
              unique: true, name: 'idx_gl_accounts_unique_code'

    # Unique constraint: one external ID per company per provider
    add_index :gl_accounts, [:corporate_id, :external_provider, :external_tenant_id, :external_account_id],
              unique: true, name: 'idx_gl_accounts_unique_external',
              where: 'external_account_id IS NOT NULL'

    # Performance indexes
    add_index :gl_accounts, :account_type
    add_index :gl_accounts, :account_class
    add_index :gl_accounts, :is_bank_account
    add_index :gl_accounts, :active
  end
end
