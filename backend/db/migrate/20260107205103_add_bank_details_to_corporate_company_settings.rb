class AddBankDetailsToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_settings, :bank_name, :string
    add_column :corporate_settings, :bank_bsb, :string
    add_column :corporate_settings, :bank_account_number, :string
    add_column :corporate_settings, :bank_account_name, :string
  end
end
