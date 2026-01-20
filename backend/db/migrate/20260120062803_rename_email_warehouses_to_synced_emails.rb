# frozen_string_literal: true

# Part of the "Warehouse" table rename initiative to reduce confusion:
# - email_warehouses → synced_emails (synced email records)
# - warehouse_contacts → xero_contacts (done in prior migration)
# - warehouse_bank_transactions → xero_bank_transactions (done in prior migration)
#
# The term "warehouse" was confusing because only warehouse_documents is the actual
# File Warehouse. email_warehouses are synced email records from Microsoft 365/IMAP.
#
# CRITICAL: Also updates polymorphic references in warehouse_documents table
class RenameEmailWarehousesToSyncedEmails < ActiveRecord::Migration[8.0]
  def up
    # Rename the table
    rename_table :email_warehouses, :synced_emails

    # Update polymorphic type in warehouse_documents
    # This ensures the File Warehouse links to emails still work
    execute <<-SQL
      UPDATE warehouse_documents
      SET documentable_type = 'SyncedEmail'
      WHERE documentable_type = 'EmailWarehouse'
    SQL
  end

  def down
    # Rename the table back
    rename_table :synced_emails, :email_warehouses

    # Revert polymorphic type
    execute <<-SQL
      UPDATE warehouse_documents
      SET documentable_type = 'EmailWarehouse'
      WHERE documentable_type = 'SyncedEmail'
    SQL
  end
end
