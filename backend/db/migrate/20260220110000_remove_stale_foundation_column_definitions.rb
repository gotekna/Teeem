# frozen_string_literal: true

# Removes Foundation column definitions that reference DB columns which no longer
# exist (renamed or removed). These stale definitions caused PG::UndefinedColumn
# errors in RecordsController when users filtered or sorted on those columns.
#
# Stale columns identified via Sentry (all reported as PG::UndefinedColumn):
#   external_invoices.xero_tenant_id    → was renamed to xero_org_id
#   synced_emails.mailbox_email         → was renamed to mailbox_owner_email
#   xero_sync_sessions.xero_tenant_id  → column never existed in this table
#   purchase_orders.position            → column was removed
#   pricebooks.supplier_contact_id      → was renamed to supplier_id
class RemoveStaleFoundationColumnDefinitions < ActiveRecord::Migration[7.2]
  # Pairs of [foundation_database_table_name, stale_column_name]
  STALE_COLUMNS = [
    ["external_invoices",  "xero_tenant_id"],
    ["synced_emails",      "mailbox_email"],
    ["xero_sync_sessions", "xero_tenant_id"],
    ["purchase_orders",    "position"],
    ["pricebooks",         "supplier_contact_id"]
  ].freeze

  def up
    conn = ActiveRecord::Base.connection

    STALE_COLUMNS.each do |table_name, column_name|
      quoted_table  = conn.quote(table_name)
      quoted_column = conn.quote(column_name)

      # Find all foundation IDs for this database table
      foundation_ids = conn.select_values(
        "SELECT id FROM foundations WHERE database_table_name = #{quoted_table}"
      )

      if foundation_ids.empty?
        say "No foundation found for table #{table_name} — skipping #{column_name}"
        next
      end

      ids_list = foundation_ids.join(", ")
      deleted_count = conn.delete(
        "DELETE FROM columns WHERE foundation_id IN (#{ids_list}) AND column_name = #{quoted_column}"
      )

      say "Removed #{deleted_count} stale column definition(s): #{table_name}.#{column_name}"
    end
  end

  def down
    # Intentionally not reversible - these column definitions referenced DB columns
    # that no longer exist. Re-inserting them would re-introduce the Sentry errors.
    raise ActiveRecord::IrreversibleMigration,
      "Cannot re-add stale column definitions referencing non-existent DB columns"
  end
end
