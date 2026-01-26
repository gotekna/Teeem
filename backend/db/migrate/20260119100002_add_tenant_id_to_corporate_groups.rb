# frozen_string_literal: true

# Phase 3: Link CorporateGroup to Tenant
#
# Maps existing CorporateGroups to Tenants:
#   - CorporateGroup 73 (TEEEM) → Tenant 1 (TEEEM)
#   - CorporateGroup 1 (Tekna Group) → Tenant 2 (Tekna)
#   - CorporateGroup 4, 35-40 (Tekna sub-groups) → Tenant 2 (Tekna)
#   - CorporateGroup 74 (Pilgrim Homes) → Tenant 3 (Pilgrim)
#   - All other groups → Tenant 2 (Tekna) as default
#
class AddTenantIdToCorporateGroups < ActiveRecord::Migration[8.0]
  def change
    # Add tenant_id column
    add_column :corporate_groups, :tenant_id, :bigint
    add_index :corporate_groups, :tenant_id
    add_foreign_key :corporate_groups, :tenants

    reversible do |dir|
      dir.up do
        # Map CorporateGroup 73 (TEEEM) → Tenant 1 (TEEEM)
        execute "UPDATE corporate_groups SET tenant_id = 1 WHERE id = 73;"

        # Map CorporateGroup 1 (Tekna Group) → Tenant 2 (Tekna)
        execute "UPDATE corporate_groups SET tenant_id = 2 WHERE id = 1;"

        # Map CorporateGroup 4, 35-40 (Tekna sub-groups) → Tenant 2 (Tekna)
        execute "UPDATE corporate_groups SET tenant_id = 2 WHERE id IN (4, 35, 36, 37, 38, 39, 40);"

        # Map CorporateGroup 74 (Pilgrim Homes) → Tenant 3 (Pilgrim)
        execute "UPDATE corporate_groups SET tenant_id = 3 WHERE id = 74;"

        # Any remaining groups default to Tekna (Tenant 2)
        execute "UPDATE corporate_groups SET tenant_id = 2 WHERE tenant_id IS NULL;"
      end

      dir.down do
        execute "UPDATE corporate_groups SET tenant_id = NULL;"
      end
    end
  end
end
