class CreateCorporateCompanyXeroData < ActiveRecord::Migration[8.0]
  def change
    # Monthly Profit & Loss data (NEW - cached from Xero reports)
    create_table :corporate_company_monthly_pls do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.date :month, null: false                                    # First day of month
      t.string :month_label                                         # "Jan 2024" for display
      t.decimal :revenue, precision: 15, scale: 2, default: 0
      t.decimal :expenses, precision: 15, scale: 2, default: 0
      t.decimal :net_profit, precision: 15, scale: 2, default: 0
      t.datetime :synced_at

      t.timestamps
    end
    add_index :corporate_company_monthly_pls, [:corporate_company_id, :month], unique: true, name: 'idx_company_monthly_pl_unique'

    # Add missing fields to existing xero_accounts table
    add_column :corporate_company_xero_accounts, :account_class, :string unless column_exists?(:corporate_company_xero_accounts, :account_class)
    add_column :corporate_company_xero_accounts, :status, :string unless column_exists?(:corporate_company_xero_accounts, :status)
    add_column :corporate_company_xero_accounts, :bank_account_number, :string unless column_exists?(:corporate_company_xero_accounts, :bank_account_number)
    add_column :corporate_company_xero_accounts, :currency_code, :string unless column_exists?(:corporate_company_xero_accounts, :currency_code)
    add_column :corporate_company_xero_accounts, :reporting_code, :string unless column_exists?(:corporate_company_xero_accounts, :reporting_code)
    add_column :corporate_company_xero_accounts, :reporting_code_name, :string unless column_exists?(:corporate_company_xero_accounts, :reporting_code_name)
    add_column :corporate_company_xero_accounts, :enable_payments, :boolean, default: false unless column_exists?(:corporate_company_xero_accounts, :enable_payments)
    add_column :corporate_company_xero_accounts, :show_in_expense_claims, :boolean, default: false unless column_exists?(:corporate_company_xero_accounts, :show_in_expense_claims)
    add_column :corporate_company_xero_accounts, :synced_at, :datetime unless column_exists?(:corporate_company_xero_accounts, :synced_at)

    # Track last sync times per data type on the connection
    add_column :corporate_company_xero_connections, :monthly_pl_synced_at, :datetime unless column_exists?(:corporate_company_xero_connections, :monthly_pl_synced_at)
    add_column :corporate_company_xero_connections, :accounts_synced_at, :datetime unless column_exists?(:corporate_company_xero_connections, :accounts_synced_at)
    add_column :corporate_company_xero_connections, :invoices_synced_at, :datetime unless column_exists?(:corporate_company_xero_connections, :invoices_synced_at)
    add_column :corporate_company_xero_connections, :balance_sheet_synced_at, :datetime unless column_exists?(:corporate_company_xero_connections, :balance_sheet_synced_at)
  end
end
