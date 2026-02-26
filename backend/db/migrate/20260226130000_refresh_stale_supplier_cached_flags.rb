# FRC (Feb 2026): Contact #269 (Spot On Plumbing) had 91 pricebook items but
# is_supplier_cached=false, hiding the Pricebook tab.
#
# Root cause: is_supplier_cached was introduced but never backfilled for
# pre-existing contacts with pricebook items/price histories/POs/bills.
# Callbacks only fire on NEW creates/destroys, not pre-existing data.
#
# This migration recalculates is_supplier_cached for ALL contacts using
# efficient SQL EXISTS subqueries (no N+1, runs in seconds).
class RefreshStaleSupplierCachedFlags < ActiveRecord::Migration[8.0]
  def up
    # Set is_supplier_cached=true for contacts that have supplier data
    # but are currently marked as false
    execute(<<-SQL.squish)
      UPDATE contacts
      SET is_supplier_cached = true, updated_at = NOW()
      WHERE is_supplier_cached = false
        AND (
          EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.supplier_id = contacts.id)
          OR EXISTS (SELECT 1 FROM pricebooks WHERE pricebooks.supplier_id = contacts.id)
          OR EXISTS (SELECT 1 FROM price_histories WHERE price_histories.supplier_id = contacts.id)
          OR EXISTS (SELECT 1 FROM external_invoices WHERE external_invoices.contact_id = contacts.id AND external_invoices.invoice_type = 'bill')
        )
    SQL

    # Also fix the reverse: contacts marked as supplier but no longer have data
    execute(<<-SQL.squish)
      UPDATE contacts
      SET is_supplier_cached = false, updated_at = NOW()
      WHERE is_supplier_cached = true
        AND NOT EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.supplier_id = contacts.id)
        AND NOT EXISTS (SELECT 1 FROM pricebooks WHERE pricebooks.supplier_id = contacts.id)
        AND NOT EXISTS (SELECT 1 FROM price_histories WHERE price_histories.supplier_id = contacts.id)
        AND NOT EXISTS (SELECT 1 FROM external_invoices WHERE external_invoices.contact_id = contacts.id AND external_invoices.invoice_type = 'bill')
    SQL
  end

  def down
    # No rollback needed - cache can be recalculated anytime
  end
end
