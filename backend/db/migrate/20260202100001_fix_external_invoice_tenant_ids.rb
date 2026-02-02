# frozen_string_literal: true

# FRC (Feb 2026): Fix invoices created with wrong tenant_id
# Root cause: ExternalInvoiceSyncService was using Xero UUID where TEEEM integer expected
# All XeroCredentials have teeem_tenant_id=2 (Tekna), so all invoices should be tenant 2
class FixExternalInvoiceTenantIds < ActiveRecord::Migration[8.0]
  def up
    # Fix invoices with wrong tenant_id (1 and 3 should be 2)
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
