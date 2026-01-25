# frozen_string_literal: true

# Migration: StorageConfiguration from Organization to Tenant
#
# Part of the 3-month tenancy architecture SSoT fix.
#
# BEFORE:
#   StorageConfiguration belongs_to :organization
#   organization_id is required
#
# AFTER:
#   StorageConfiguration belongs_to :tenant
#   tenant_id is required
#   organization_id is optional (deprecated, will be removed later)
#
# This migration:
# 1. Adds tenant_id column
# 2. Copies tenant_id from associated organization
# 3. Makes tenant_id NOT NULL
# 4. Updates unique constraint to be on tenant_id
# 5. Makes organization_id optional (nullable) for soft deprecation
#
class MigrateStorageConfigurationToTenant < ActiveRecord::Migration[7.2]
  def up
    # Step 1: Add tenant_id column (nullable initially for migration)
    add_column :storage_configurations, :tenant_id, :bigint, null: true

    # Step 2: Add index for tenant_id
    add_index :storage_configurations, :tenant_id

    # Step 3: Copy tenant_id from associated organization
    execute <<-SQL
      UPDATE storage_configurations sc
      SET tenant_id = o.tenant_id
      FROM organizations o
      WHERE sc.organization_id = o.id
        AND o.tenant_id IS NOT NULL
    SQL

    # Step 4: For any storage_configurations without a tenant (shouldn't happen),
    # assign them to the first organization's tenant or the first tenant
    execute <<-SQL
      UPDATE storage_configurations
      SET tenant_id = (
        SELECT COALESCE(
          (SELECT tenant_id FROM organizations WHERE id = storage_configurations.organization_id LIMIT 1),
          (SELECT id FROM tenants ORDER BY id LIMIT 1)
        )
      )
      WHERE tenant_id IS NULL
    SQL

    # Step 5: Make tenant_id NOT NULL now that all records have values
    change_column_null :storage_configurations, :tenant_id, false

    # Step 6: Add unique constraint on tenant_id (one storage config per tenant)
    add_index :storage_configurations, :tenant_id, unique: true, name: 'index_storage_configurations_on_tenant_id_unique'

    # Step 7: Make organization_id nullable (soft deprecation)
    change_column_null :storage_configurations, :organization_id, true

    # Step 8: Add foreign key constraint for tenant_id
    add_foreign_key :storage_configurations, :tenants

    say "Migrated #{StorageConfiguration.count rescue 'unknown'} storage configurations to tenant-level"
  end

  def down
    # Step 1: Make organization_id NOT NULL again
    # First, fill in any nulls with the first organization for that tenant
    execute <<-SQL
      UPDATE storage_configurations sc
      SET organization_id = (
        SELECT o.id FROM organizations o
        WHERE o.tenant_id = sc.tenant_id
        ORDER BY o.id
        LIMIT 1
      )
      WHERE sc.organization_id IS NULL
    SQL

    change_column_null :storage_configurations, :organization_id, false

    # Step 2: Remove foreign key constraint
    remove_foreign_key :storage_configurations, :tenants

    # Step 3: Remove unique constraint on tenant_id
    remove_index :storage_configurations, name: 'index_storage_configurations_on_tenant_id_unique'

    # Step 4: Remove index on tenant_id
    remove_index :storage_configurations, :tenant_id

    # Step 5: Remove tenant_id column
    remove_column :storage_configurations, :tenant_id
  end
end
