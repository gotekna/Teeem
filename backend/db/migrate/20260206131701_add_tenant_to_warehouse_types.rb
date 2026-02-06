# frozen_string_literal: true

# Migration: Add tenant_id to warehouse_types
#
# Part of "Eliminate warehouse_folders, Make base_folders Tenant-Specific" refactor.
# This makes warehouse_types tenant-scoped, allowing each tenant to have their own
# folder structure configuration.
#
# SSoT: warehouse_types with tenant_id is now THE ONE source for tenant-specific warehouse types.
#
class AddTenantToWarehouseTypes < ActiveRecord::Migration[7.2]
  def change
    # Add tenant reference (optional to allow templates or global types)
    add_reference :warehouse_types, :tenant, foreign_key: true, null: true

    # Add index for tenant queries
    add_index :warehouse_types, [:tenant_id, :code], unique: true, name: 'idx_warehouse_types_tenant_code'
  end
end
