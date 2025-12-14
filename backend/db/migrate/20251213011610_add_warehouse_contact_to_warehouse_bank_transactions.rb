# frozen_string_literal: true

# Adds FK from WarehouseBankTransaction to WarehouseContact
# This links bank transactions to the SSoT for Xero contact data
class AddWarehouseContactToWarehouseBankTransactions < ActiveRecord::Migration[8.0]
  def change
    # Allow null initially - will be populated by sync job based on xero_contact_id
    add_reference :warehouse_bank_transactions, :warehouse_contact, null: true, foreign_key: true
  end
end
