# frozen_string_literal: true

class AddMissingColumnsToGlAccounts < ActiveRecord::Migration[8.0]
  def change
    # Add missing columns to gl_accounts table
    # The original migration was marked as run but columns weren't created

    unless column_exists?(:gl_accounts, :corporate_company_id)
      add_reference :gl_accounts, :corporate_company, null: false, foreign_key: true
    end

    unless column_exists?(:gl_accounts, :external_provider)
      add_column :gl_accounts, :external_provider, :string
      add_column :gl_accounts, :external_tenant_id, :string
      add_column :gl_accounts, :external_account_id, :string
      add_column :gl_accounts, :external_synced_at, :datetime
    end

    unless column_exists?(:gl_accounts, :code)
      add_column :gl_accounts, :code, :string, null: false, default: ''
      add_column :gl_accounts, :name, :string, null: false, default: ''
      add_column :gl_accounts, :description, :string
    end

    unless column_exists?(:gl_accounts, :account_type)
      add_column :gl_accounts, :account_type, :string, null: false, default: 'asset'
      add_column :gl_accounts, :account_class, :string
      add_column :gl_accounts, :system_account, :string
    end

    unless column_exists?(:gl_accounts, :tax_type)
      add_column :gl_accounts, :tax_type, :string
    end

    unless column_exists?(:gl_accounts, :is_bank_account)
      add_column :gl_accounts, :is_bank_account, :boolean, default: false
      add_column :gl_accounts, :is_system_account, :boolean, default: false
      add_column :gl_accounts, :active, :boolean, default: true
      add_column :gl_accounts, :show_in_expense_claims, :boolean, default: false
    end

    unless column_exists?(:gl_accounts, :parent_account_id)
      add_reference :gl_accounts, :parent_account, foreign_key: { to_table: :gl_accounts }
      add_column :gl_accounts, :display_order, :integer
    end

    unless column_exists?(:gl_accounts, :currency_code)
      add_column :gl_accounts, :currency_code, :string, default: 'AUD'
    end

    # Add indexes if they don't exist
    unless index_exists?(:gl_accounts, [:corporate_company_id, :external_provider, :external_tenant_id, :code], name: 'idx_gl_accounts_unique_code')
      add_index :gl_accounts, [:corporate_company_id, :external_provider, :external_tenant_id, :code],
                unique: true, name: 'idx_gl_accounts_unique_code'
    end

    unless index_exists?(:gl_accounts, :account_type)
      add_index :gl_accounts, :account_type
      add_index :gl_accounts, :account_class
      add_index :gl_accounts, :is_bank_account
      add_index :gl_accounts, :active
    end
  end
end
