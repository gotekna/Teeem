class AddTenantIdToBankTransactions < ActiveRecord::Migration[8.0]
  def up
    add_reference :bank_transactions, :tenant, null: true, foreign_key: false, index: true

    # Backfill from corporate_company → tenant
    execute <<-SQL
      UPDATE bank_transactions
      SET tenant_id = corporate_companies.tenant_id
      FROM corporate_companies
      WHERE bank_transactions.company_id = corporate_companies.id
      AND bank_transactions.tenant_id IS NULL
      AND corporate_companies.tenant_id IS NOT NULL
    SQL

    orphaned = execute("SELECT COUNT(*) FROM bank_transactions WHERE tenant_id IS NULL").first["count"].to_i
    if orphaned > 0
      puts "⚠️  Deleting #{orphaned} orphaned bank_transactions"
      execute "DELETE FROM bank_transactions WHERE tenant_id IS NULL"
    end

    change_column_null :bank_transactions, :tenant_id, false
    add_foreign_key :bank_transactions, :tenants
    puts "✅ bank_transactions tenant scoping complete"
  end

  def down
    remove_foreign_key :bank_transactions, :tenants
    remove_reference :bank_transactions, :tenant
  end
end
