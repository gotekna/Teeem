class AddTenantIdToCorporateModels < ActiveRecord::Migration[8.0]
  def change
    # Add tenant_id to corporate child tables for direct tenant scoping
    # These models belong to Corporate, which is already tenant-scoped
    # Adding tenant_id directly enables efficient acts_as_tenant queries

    add_reference :corporate_activities, :tenant, foreign_key: true, index: true
    add_reference :corporate_compliance_items, :tenant, foreign_key: true, index: true
    add_reference :corporate_directors, :tenant, foreign_key: true, index: true
    add_reference :corporate_loans, :tenant, foreign_key: true, index: true
    add_reference :corporate_minutes, :tenant, foreign_key: true, index: true
    add_reference :corporate_monthly_pls, :tenant, foreign_key: true, index: true
    add_reference :corporate_shareholdings, :tenant, foreign_key: true, index: true
    add_reference :corporate_xero_accounts, :tenant, foreign_key: true, index: true
    add_reference :corporate_xero_connections, :tenant, foreign_key: true, index: true
  end
end
