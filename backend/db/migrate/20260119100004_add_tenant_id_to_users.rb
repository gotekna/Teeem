# frozen_string_literal: true

# Phase 6: Add tenant_id to Users
#
# Users are linked to tenants for multi-tenancy.
# The corporate_group_id is kept for backwards compatibility but is DEPRECATED.
#
class AddTenantIdToUsers < ActiveRecord::Migration[8.0]
  def change
    # Add tenant_id column
    add_column :users, :tenant_id, :bigint unless column_exists?(:users, :tenant_id)
    add_index :users, :tenant_id unless index_exists?(:users, :tenant_id)
    add_foreign_key :users, :tenants unless foreign_key_exists?(:users, :tenants)

    reversible do |dir|
      dir.up do
        # Populate tenant_id from corporate_group_id via corporate_groups
        execute <<-SQL
          UPDATE users
          SET tenant_id = cg.tenant_id
          FROM corporate_groups cg
          WHERE users.corporate_group_id = cg.id
            AND users.tenant_id IS NULL
            AND users.corporate_group_id IS NOT NULL;
        SQL

        # For users without corporate_group_id, default to Tekna (Tenant 2)
        execute <<-SQL
          UPDATE users
          SET tenant_id = 2
          WHERE tenant_id IS NULL;
        SQL
      end

      dir.down do
        execute "UPDATE users SET tenant_id = NULL;"
      end
    end
  end
end
