class AddTenantIdToBillPayments < ActiveRecord::Migration[8.0]
  def up
    add_reference :bill_payments, :tenant, null: true, foreign_key: false, index: true

    # Backfill from bill_inbox → tenant
    execute <<-SQL
      UPDATE bill_payments
      SET tenant_id = bill_inboxes.tenant_id
      FROM bill_inboxes
      WHERE bill_payments.bill_inbox_id = bill_inboxes.id
      AND bill_payments.tenant_id IS NULL
    SQL

    # Delete orphaned records
    orphaned = execute("SELECT COUNT(*) FROM bill_payments WHERE tenant_id IS NULL").first["count"].to_i
    if orphaned > 0
      puts "⚠️  Deleting #{orphaned} orphaned bill_payments"
      execute "DELETE FROM bill_payments WHERE tenant_id IS NULL"
    end

    change_column_null :bill_payments, :tenant_id, false
    add_foreign_key :bill_payments, :tenants
    puts "✅ bill_payments tenant scoping complete"
  end

  def down
    remove_foreign_key :bill_payments, :tenants
    remove_reference :bill_payments, :tenant
  end
end
