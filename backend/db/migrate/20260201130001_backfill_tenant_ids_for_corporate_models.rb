class BackfillTenantIdsForCorporateModels < ActiveRecord::Migration[8.0]
  def up
    # Backfill tenant_id from parent Corporate record
    # Most tables use company_id as FK to corporates

    # corporate_activities (company_id → corporates.id)
    execute <<-SQL
      UPDATE corporate_activities
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_activities.company_id = c.id
        AND corporate_activities.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_compliance_items (company_id → corporates.id)
    execute <<-SQL
      UPDATE corporate_compliance_items
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_compliance_items.company_id = c.id
        AND corporate_compliance_items.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_directors (company_id → corporates.id)
    execute <<-SQL
      UPDATE corporate_directors
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_directors.company_id = c.id
        AND corporate_directors.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_loans (lender_company_id → corporates.id)
    # Use lender as the tenant reference
    execute <<-SQL
      UPDATE corporate_loans
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_loans.lender_company_id = c.id
        AND corporate_loans.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_minutes (company_id → corporates.id)
    execute <<-SQL
      UPDATE corporate_minutes
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_minutes.company_id = c.id
        AND corporate_minutes.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_monthly_pls (corporate_id → corporates.id)
    execute <<-SQL
      UPDATE corporate_monthly_pls
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_monthly_pls.corporate_id = c.id
        AND corporate_monthly_pls.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_shareholdings (company_id → corporates.id)
    execute <<-SQL
      UPDATE corporate_shareholdings
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_shareholdings.company_id = c.id
        AND corporate_shareholdings.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_xero_connections (company_id → corporates.id)
    execute <<-SQL
      UPDATE corporate_xero_connections
      SET tenant_id = c.tenant_id
      FROM corporates c
      WHERE corporate_xero_connections.company_id = c.id
        AND corporate_xero_connections.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL

    # corporate_xero_accounts (corporate_xero_connection_id → corporate_xero_connections.id → corporates.id)
    execute <<-SQL
      UPDATE corporate_xero_accounts
      SET tenant_id = c.tenant_id
      FROM corporate_xero_connections cxc
      JOIN corporates c ON cxc.company_id = c.id
      WHERE corporate_xero_accounts.corporate_xero_connection_id = cxc.id
        AND corporate_xero_accounts.tenant_id IS NULL
        AND c.tenant_id IS NOT NULL;
    SQL
  end

  def down
    # No need to reverse - these are just data updates
    # The column removal is handled by the previous migration's rollback
  end
end
