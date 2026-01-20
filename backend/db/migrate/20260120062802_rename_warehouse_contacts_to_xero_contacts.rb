# frozen_string_literal: true

# Part of the "Warehouse" table rename initiative to reduce confusion:
# - warehouse_contacts → xero_contacts (Xero contact cache)
# - warehouse_bank_transactions → xero_bank_transactions (done in prior migration)
# - email_warehouses → synced_emails (upcoming migration)
#
# The term "warehouse" was confusing because only warehouse_documents is the actual
# File Warehouse. These other tables are just Xero sync caches.
#
# NOTE: We keep the FK column as `warehouse_contact_id` because `xero_contact_id`
# already exists as a string column storing the Xero API Contact ID. To avoid
# confusion, we use explicit foreign_key in the model associations.
class RenameWarehouseContactsToXeroContacts < ActiveRecord::Migration[8.0]
  def change
    # Rename the table only - FK columns keep their names to avoid collision
    # with existing xero_contact_id string columns
    rename_table :warehouse_contacts, :xero_contacts
  end
end
