class AddBankCodeToBankAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :bank_accounts, :bank_code, :string
  end
end
