# frozen_string_literal: true

# Add trading_names array to CorporateCompany
#
# Some companies operate under different trading names.
# Example: Gen2612 Pty Ltd trades as "100xBestLife"
#
# This enables display_name to return the trading name when appropriate.
#
class AddTradingNamesToCorporateCompanies < ActiveRecord::Migration[8.0]
  def up
    add_column :corporate_companies, :trading_names, :string, array: true, default: []
    add_index :corporate_companies, :trading_names, using: :gin

    # Set trading name for Gen2612 (100xBestLife)
    execute <<-SQL.squish
      UPDATE corporate_companies
      SET trading_names = ARRAY['100xBestLife']
      WHERE id = 7;
    SQL
  end

  def down
    remove_index :corporate_companies, :trading_names
    remove_column :corporate_companies, :trading_names
  end
end
