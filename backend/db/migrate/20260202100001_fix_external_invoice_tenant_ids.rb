# frozen_string_literal: true

# FRC (Feb 2026): Fix invoices created with wrong tenant_id
# Root cause: ExternalInvoiceSyncService was using Xero UUID where TEEEM integer expected
# All XeroCredentials have teeem_tenant_id=2 (Tekna), so all invoices should be tenant 2
#
# Note: There's a unique constraint on (source, tenant_id, external_id)
# Some invoices in tenant 1/3 are duplicates of existing tenant 2 invoices
# - Delete duplicates (keep tenant 2 version)
# - Update orphans (no tenant 2 version exists)
class FixExternalInvoiceTenantIds < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Delete duplicates (invoices in tenant 1/3 that already exist in tenant 2)
    execute <<~SQL
      DELETE FROM external_invoices
      WHERE tenant_id IN (1, 3)
      AND external_id IN (
        SELECT external_id FROM external_invoices WHERE tenant_id = 2
      )
    SQL

    # Step 2: Update remaining orphans to tenant 2
    execute <<~SQL
      UPDATE external_invoices
      SET tenant_id = 2, updated_at = NOW()
      WHERE tenant_id IN (1, 3)
    SQL
  end

  def down
    # Cannot safely reverse - we don't know original tenant_id
    raise ActiveRecord::IrreversibleMigration
  end
end
