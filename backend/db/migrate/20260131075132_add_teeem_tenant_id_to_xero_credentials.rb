# frozen_string_literal: true

# Add TEEEM tenant scoping to XeroCredential
#
# This enables multi-tenancy isolation for Xero connections.
# Each tenant can only see/manage their own Xero organizations.
#
# Note: tenant_id already exists but refers to Xero's tenant ID (organization ID).
# teeem_tenant_id refers to the TEEEM Tenant for multi-tenancy isolation.
#
class AddTeeemTenantIdToXeroCredentials < ActiveRecord::Migration[8.0]
  def up
    # Add column (nullable initially)
    add_column :xero_credentials, :teeem_tenant_id, :bigint
    add_index :xero_credentials, :teeem_tenant_id
    add_foreign_key :xero_credentials, :tenants, column: :teeem_tenant_id

    # Set existing records to master tenant
    master_tenant = Tenant.find_by(is_master_tenant: true)
    if master_tenant
      execute <<-SQL
        UPDATE xero_credentials SET teeem_tenant_id = #{master_tenant.id}
      SQL
    end
  end

  def down
    remove_foreign_key :xero_credentials, column: :teeem_tenant_id
    remove_index :xero_credentials, :teeem_tenant_id
    remove_column :xero_credentials, :teeem_tenant_id
  end
end
