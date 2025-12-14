class AddAbaFieldsToBankAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :bank_accounts, :aba_user_name, :string, limit: 26  # Max 26 chars per ABA spec
    add_column :bank_accounts, :aba_user_number, :string, limit: 6  # Max 6 digits
    add_column :bank_accounts, :aba_file_description, :string, limit: 12
    add_column :bank_accounts, :is_ap_enabled, :boolean, default: false
    add_column :bank_accounts, :next_aba_sequence, :integer, default: 1

    add_index :bank_accounts, [ :company_id, :is_ap_enabled ], name: 'idx_bank_accounts_company_ap'
  end
end
