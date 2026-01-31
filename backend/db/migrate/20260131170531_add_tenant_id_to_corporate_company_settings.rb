class AddTenantIdToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add column allowing null initially (existing data has no tenant)
    add_reference :corporate_company_settings, :tenant, null: true, foreign_key: true

    # Step 2: Assign existing record(s) to Tekna tenant (id=2) since that's where the data belongs
    execute <<-SQL
      UPDATE corporate_company_settings
      SET tenant_id = 2
      WHERE tenant_id IS NULL;
    SQL

    # Step 3: Create records for other existing tenants with neutral defaults
    # Use raw SQL to avoid acts_as_tenant scoping issues during migration
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
      WHERE t.id != 2
      AND NOT EXISTS (
        SELECT 1 FROM corporate_company_settings ccs WHERE ccs.tenant_id = t.id
      );
    SQL

    # Step 4: Add NOT NULL constraint and unique index
    change_column_null :corporate_company_settings, :tenant_id, false
    add_index :corporate_company_settings, :tenant_id, unique: true, name: 'index_corporate_company_settings_on_tenant_unique'
  end

  def down
    remove_index :corporate_company_settings, name: 'index_corporate_company_settings_on_tenant_unique', if_exists: true
    remove_reference :corporate_company_settings, :tenant
  end
end
