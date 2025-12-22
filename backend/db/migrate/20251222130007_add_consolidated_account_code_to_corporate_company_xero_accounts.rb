class AddConsolidatedAccountCodeToCorporateCompanyXeroAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_company_xero_accounts, :consolidated_account_code, :string
  end
end
