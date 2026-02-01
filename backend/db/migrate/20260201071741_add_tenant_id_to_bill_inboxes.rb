class AddTenantIdToBillInboxes < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add tenant_id column (nullable initially for backfill)
    add_reference :bill_inboxes, :tenant, null: true, foreign_key: false, index: true

    # Step 2: Backfill tenant_id from corporate_company (direct tenant_id relationship)
    # Use raw SQL for performance (avoids loading all records into memory)
    execute <<-SQL
      UPDATE bill_inboxes
      SET tenant_id = corporate_companies.tenant_id
      FROM corporate_companies
      WHERE bill_inboxes.corporate_company_id = corporate_companies.id
      AND bill_inboxes.tenant_id IS NULL
      AND corporate_companies.tenant_id IS NOT NULL
    SQL

    # Step 3: Check for orphaned records (no corporate_company or tenant)
    orphaned_count = execute("SELECT COUNT(*) FROM bill_inboxes WHERE tenant_id IS NULL").first["count"].to_i
    if orphaned_count > 0
      puts "⚠️  WARNING: #{orphaned_count} bill_inboxes have no tenant (missing corporate_company link)"
      puts "    These records will be deleted to maintain data integrity."
      execute "DELETE FROM bill_inboxes WHERE tenant_id IS NULL"
    end

    # Step 4: Make tenant_id NOT NULL and add foreign key
    change_column_null :bill_inboxes, :tenant_id, false
    add_foreign_key :bill_inboxes, :tenants

    puts "✅ Bill Inbox tenant scoping migration complete"
  end

  def down
    remove_foreign_key :bill_inboxes, :tenants
    remove_reference :bill_inboxes, :tenant
  end
end
