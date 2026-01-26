# frozen_string_literal: true

# Migration: Add tenant_id to organizations and backup_configurations
#
# Organizations are sub-tenants within a Tenant:
#   Tenant (Tekna) → Organizations (Tekna, 100xBestLife, Homes of Hope, Love Your World)
#
# This links Organizations to their parent Tenant and updates backups
# to be scoped by Tenant instead of Organization.
#
class AddTenantToOrganizationsAndBackups < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add tenant_id to organizations
    unless column_exists?(:organizations, :tenant_id)
      add_column :organizations, :tenant_id, :bigint
      add_index :organizations, :tenant_id
      add_foreign_key :organizations, :tenants
    end

    # Step 2: Link all organizations to Tekna tenant (id=2)
    # All current organizations are sub-tenants of Tekna
    execute <<-SQL
      UPDATE organizations SET tenant_id = 2 WHERE tenant_id IS NULL
    SQL

    # Step 3: Add tenant_id to backup_configurations
    unless column_exists?(:backup_configurations, :tenant_id)
      add_column :backup_configurations, :tenant_id, :bigint
      add_index :backup_configurations, :tenant_id
      add_foreign_key :backup_configurations, :tenants
    end

    # Step 4: Migrate backup_configurations from organization_id to tenant_id
    # All organizations belong to Tekna (tenant_id=2)
    execute <<-SQL
      UPDATE backup_configurations
      SET tenant_id = 2
      WHERE tenant_id IS NULL AND organization_id IS NOT NULL
    SQL

    # Step 5: Remove organization_id from backup_configurations
    if column_exists?(:backup_configurations, :organization_id)
      if foreign_key_exists?(:backup_configurations, column: :organization_id)
        remove_foreign_key :backup_configurations, column: :organization_id
      end
      if index_exists?(:backup_configurations, :organization_id)
        remove_index :backup_configurations, :organization_id
      end
      remove_column :backup_configurations, :organization_id
    end

    puts "  Organizations linked to Tenant"
    puts "  Backup configurations migrated to use tenant_id"
  end

  def down
    # Add organization_id back to backup_configurations
    add_column :backup_configurations, :organization_id, :bigint
    add_index :backup_configurations, :organization_id

    # Cannot accurately reverse tenant_id → organization_id mapping
    # Would need to know which organization each backup belonged to

    # Remove tenant_id from backup_configurations
    remove_column :backup_configurations, :tenant_id

    # Remove tenant_id from organizations
    remove_column :organizations, :tenant_id
  end
end
