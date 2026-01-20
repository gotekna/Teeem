# frozen_string_literal: true

# LIM: Removing redundant XeroContact table
#
# Analysis (Jan 2026):
# - XeroContact: 0 records (EMPTY - never used)
# - ContactExternalLink: 1,018 records (ACTIVELY USED)
#
# Both tables serve the same purpose (linking TEEEM contacts to Xero contacts).
# ContactExternalLink is THE ONE SSoT - XeroContact was over-engineered and never populated.
#
# This migration:
# 1. Removes the FK column from xero_bank_transactions
# 2. Removes the FK column from external_invoices
# 3. Drops the xero_contacts table entirely
class DropXeroContactsTable < ActiveRecord::Migration[8.0]
  def up
    # Remove FK columns that reference xero_contacts
    # (These were never populated since XeroContact had 0 records)
    remove_column :xero_bank_transactions, :warehouse_contact_id, :bigint
    remove_column :external_invoices, :warehouse_contact_id, :bigint

    # Drop the empty table
    drop_table :xero_contacts
  end

  def down
    # Recreate the table (simplified schema - full recreation not needed since it was never used)
    create_table :xero_contacts do |t|
      t.string :xero_id, null: false
      t.string :tenant_id, null: false
      t.string :source, default: "xero"
      t.string :name
      t.string :email_address
      t.references :contact, foreign_key: true
      t.boolean :sync_enabled, default: true
      t.timestamps
    end

    add_index :xero_contacts, [:xero_id, :tenant_id], unique: true

    # Re-add FK columns
    add_column :xero_bank_transactions, :warehouse_contact_id, :bigint
    add_column :external_invoices, :warehouse_contact_id, :bigint
  end
end
