class AllowNullToAddressesInEmailDrafts < ActiveRecord::Migration[7.1]
  def change
    # Drafts may not have recipients yet - allow null
    change_column_null :email_drafts, :to_addresses, true
  end
end
