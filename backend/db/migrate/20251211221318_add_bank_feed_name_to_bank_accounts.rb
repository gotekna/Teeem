class AddBankFeedNameToBankAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :bank_accounts, :bank_feed_name, :string
  end
end
