# frozen_string_literal: true

# Add physical display_name column to financial report tables
# This prevents Foundation sync from deleting the column metadata
class AddDisplayNameToFinancialReports < ActiveRecord::Migration[7.2]
  def change
    add_column :profit_loss_reports, :display_name, :string
    add_column :balance_sheet_reports, :display_name, :string
    add_column :bank_statement_reports, :display_name, :string
  end
end
