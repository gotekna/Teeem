class FixCrossTenantSupplierLeakage < ActiveRecord::Migration[8.0]
  # FRC (Feb 2026): Migrations 20260217130000 and 20260218200001 used raw SQL
  # to set default_supplier_id across ALL tenants using tenant-2-specific contact IDs.
  # This created ~2940 cross-tenant references (items on tenants 1/3 pointing to
  # contacts on tenant 2). This migration nulls out those invalid references.
  #
  # Root cause: Raw SQL bypassed acts_as_tenant, applying Tekna (tenant 2) supplier
  # IDs to TEEEM (tenant 1) and Pilgrim Homes (tenant 3) pricebook items.

  def up
    # Null out default_supplier_id where supplier is on a different tenant
    result = execute <<~SQL
      UPDATE pricebooks
      SET default_supplier_id = NULL
      FROM contacts
      WHERE pricebooks.default_supplier_id = contacts.id
        AND pricebooks.tenant_id != contacts.tenant_id
    SQL
    say "Cleared #{result.cmd_tuples} cross-tenant default_supplier_id references"

    # Null out supplier_id (old column) where supplier is on a different tenant
    result = execute <<~SQL
      UPDATE pricebooks
      SET supplier_id = NULL
      FROM contacts
      WHERE pricebooks.supplier_id = contacts.id
        AND pricebooks.tenant_id != contacts.tenant_id
    SQL
    say "Cleared #{result.cmd_tuples} cross-tenant supplier_id references"

    # Clean up price_histories with cross-tenant supplier references
    result = execute <<~SQL
      UPDATE price_histories
      SET supplier_id = NULL
      FROM contacts
      WHERE price_histories.supplier_id = contacts.id
        AND price_histories.tenant_id != contacts.tenant_id
    SQL
    say "Cleared #{result.cmd_tuples} cross-tenant price_history supplier references"
  end

  def down
    # Not reversible - the original cross-tenant data was incorrect
    raise ActiveRecord::IrreversibleMigration
  end
end
