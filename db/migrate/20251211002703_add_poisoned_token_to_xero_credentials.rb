class AddPoisonedTokenToXeroCredentials < ActiveRecord::Migration[8.0]
  def change
    add_column :xero_credentials, :token_poisoned_at, :datetime
    add_column :xero_credentials, :poisoned_reason, :string
  end
end
