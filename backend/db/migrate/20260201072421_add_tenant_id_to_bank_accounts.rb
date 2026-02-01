class AddTenantIdToBankAccounts < ActiveRecord::Migration[8.0]
  def up
    add_reference :bank_accounts, :tenant, null: true, foreign_key: false, index: true

    # Backfill from corporate_company → tenant
    execute <<-SQL
      UPDATE bank_accounts
      SET tenant_id = corporate_companies.tenant_id
      FROM corporate_companies
      WHERE bank_accounts.company_id = corporate_companies.id
      AND bank_accounts.tenant_id IS NULL
      AND corporate_companies.tenant_id IS NOT NULL
    SQL

    orphaned = execute("SELECT COUNT(*) FROM bank_accounts WHERE tenant_id IS NULL").first["count"].to_i
    if orphaned > 0
      puts "⚠️  Deleting #{orphaned} orphaned bank_accounts"
      execute "DELETE FROM bank_accounts WHERE tenant_id IS NULL"
    end

    change_column_null :bank_accounts, :tenant_id, false
    add_foreign_key :bank_accounts, :tenants
    puts "✅ bank_accounts tenant scoping complete"
  end

  def down
    remove_foreign_key :bank_accounts, :tenants
    remove_reference :bank_accounts, :tenant
  end
end
