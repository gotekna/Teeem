class AddTenantIdToBillPaymentBatches < ActiveRecord::Migration[8.0]
  def up
    add_reference :bill_payment_batches, :tenant, null: true, foreign_key: false, index: true

    # Backfill from corporate_company → tenant
    execute <<-SQL
      UPDATE bill_payment_batches
      SET tenant_id = corporate_companies.tenant_id
      FROM corporate_companies
      WHERE bill_payment_batches.corporate_company_id = corporate_companies.id
      AND bill_payment_batches.tenant_id IS NULL
      AND corporate_companies.tenant_id IS NOT NULL
    SQL

    orphaned = execute("SELECT COUNT(*) FROM bill_payment_batches WHERE tenant_id IS NULL").first["count"].to_i
    if orphaned > 0
      puts "⚠️  Deleting #{orphaned} orphaned bill_payment_batches"
      execute "DELETE FROM bill_payment_batches WHERE tenant_id IS NULL"
    end

    change_column_null :bill_payment_batches, :tenant_id, false
    add_foreign_key :bill_payment_batches, :tenants
    puts "✅ bill_payment_batches tenant scoping complete"
  end

  def down
    remove_foreign_key :bill_payment_batches, :tenants
    remove_reference :bill_payment_batches, :tenant
  end
end
