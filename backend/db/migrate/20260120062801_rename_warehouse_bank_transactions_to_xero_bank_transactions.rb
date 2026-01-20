# frozen_string_literal: true

# Part of the "Warehouse" table rename initiative to reduce confusion:
# - warehouse_bank_transactions → xero_bank_transactions (Xero bank feed data)
# - warehouse_contacts → xero_contacts (Xero contact cache)
# - email_warehouses → synced_emails (synced email records)
#
# The term "warehouse" was confusing because only warehouse_documents is the actual
# File Warehouse. These other tables are just Xero sync caches.
class RenameWarehouseBankTransactionsToXeroBankTransactions < ActiveRecord::Migration[8.0]
  def change
    # Rename the table
    rename_table :warehouse_bank_transactions, :xero_bank_transactions

    # Rename the foreign key column in the same table
    # (warehouse_contact_id will be renamed when we rename WarehouseContact → XeroContact)
  end
end
