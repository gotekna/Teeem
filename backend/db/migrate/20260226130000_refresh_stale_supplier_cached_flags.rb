# frozen_string_literal: true

# FRC: Contact #269 (Spot On Plumbing) has price history but is_supplier_cached=false
# Root cause: Cached flag was never updated when price histories were imported in bulk
# (before the after_commit callback was added to PriceHistory model).
#
# Fix: Recalculate is_supplier_cached for ALL contacts from source data.
# The cached flag should be true when contact has:
#   - purchase_orders (supplier_id)
#   - pricebook items (supplier_id)
#   - price_histories (supplier_id)
#   - external_invoices bills (contact_id, invoice_type='bill')
class RefreshStaleSupplierCachedFlags < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL.squish
      UPDATE contacts
      SET is_supplier_cached = (
        EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.supplier_id = contacts.id)
        OR EXISTS (SELECT 1 FROM pricebooks WHERE pricebooks.supplier_id = contacts.id)
        OR EXISTS (SELECT 1 FROM price_histories WHERE price_histories.supplier_id = contacts.id)
        OR EXISTS (SELECT 1 FROM external_invoices WHERE external_invoices.contact_id = contacts.id AND external_invoices.invoice_type = 'bill')
      )
    SQL
  end

  def down
    # No-op: cached flags are derived from source data
  end
end
