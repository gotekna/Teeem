class AddBankAccountFieldsToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :bank_name, :string
    add_column :companies, :bank_bsb, :string
    add_column :companies, :bank_account_number, :string
    add_column :companies, :bank_account_name, :string
    add_column :companies, :bank_start_date, :date
    add_column :companies, :bank_end_date, :date
  end
end
