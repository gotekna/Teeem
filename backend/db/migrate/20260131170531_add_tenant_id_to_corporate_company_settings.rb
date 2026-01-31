class AddTenantIdToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def up
    # Check if tenant_id column already exists (idempotent)
    unless column_exists?(:corporate_company_settings, :tenant_id)
      add_reference :corporate_company_settings, :tenant, null: true, foreign_key: true
    end

    # Step 2: Delete duplicate records, keeping only the first (oldest) one per tenant
    # This handles the case where another chat already created tenant-specific records
    execute <<-SQL
      DELETE FROM corporate_company_settings
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM corporate_company_settings
        GROUP BY COALESCE(tenant_id, 0)
      );
    SQL

    # Step 3: Assign any remaining unassigned record to Tekna tenant (id=2)
    execute <<-SQL
      UPDATE corporate_company_settings
      SET tenant_id = 2
      WHERE tenant_id IS NULL;
    SQL

    # Step 4: Create records for tenants that don't have one yet
    execute <<-SQL
      INSERT INTO corporate_company_settings (
        tenant_id, company_name, timezone, internal_email_domains,
        monitored_mailbox_pay, monitored_mailbox_newtask,
        monitored_mailbox_newjob, monitored_mailbox_newcase,
        working_days, created_at, updated_at
      )
      SELECT
        t.id,
        t.name,
        'Australia/Brisbane',
        '',
        '',
        '',
        '',
        '',
        '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":true}',
        NOW(),
        NOW()
      FROM tenants t
      WHERE NOT EXISTS (
        SELECT 1 FROM corporate_company_settings ccs WHERE ccs.tenant_id = t.id
      );
    SQL

    # Step 5: Add NOT NULL constraint
    change_column_null :corporate_company_settings, :tenant_id, false

    # Step 6: Add unique index (only if it doesn't exist)
    unless index_exists?(:corporate_company_settings, :tenant_id, name: 'index_corporate_company_settings_on_tenant_unique')
      add_index :corporate_company_settings, :tenant_id, unique: true, name: 'index_corporate_company_settings_on_tenant_unique'
    end
  end

  def down
    remove_index :corporate_company_settings, name: 'index_corporate_company_settings_on_tenant_unique', if_exists: true
    remove_reference :corporate_company_settings, :tenant, if_exists: true
  end
end
