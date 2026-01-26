# frozen_string_literal: true

# Phase 8: Move TenantSetting to new Tenant
#
# TenantSetting now belongs to Tenant instead of CorporateGroup.
# The corporate_group_id is kept for backwards compatibility but is DEPRECATED.
#
class AddTenantIdToTenantSettings < ActiveRecord::Migration[8.0]
  def change
    # Add tenant_id column
    add_column :tenant_settings, :tenant_id, :bigint unless column_exists?(:tenant_settings, :tenant_id)
    add_index :tenant_settings, :tenant_id unless index_exists?(:tenant_settings, :tenant_id)
    add_foreign_key :tenant_settings, :tenants unless foreign_key_exists?(:tenant_settings, :tenants)

    reversible do |dir|
      dir.up do
        # Populate tenant_id from corporate_group_id via corporate_groups
        execute <<-SQL
          UPDATE tenant_settings
          SET tenant_id = cg.tenant_id
          FROM corporate_groups cg
          WHERE tenant_settings.corporate_group_id = cg.id
            AND tenant_settings.tenant_id IS NULL
            AND tenant_settings.corporate_group_id IS NOT NULL;
        SQL

        # For settings without corporate_group_id, default to Tekna (Tenant 2)
        execute <<-SQL
          UPDATE tenant_settings
          SET tenant_id = 2
          WHERE tenant_id IS NULL;
        SQL
      end

      dir.down do
        execute "UPDATE tenant_settings SET tenant_id = NULL;"
      end
    end
  end
end
