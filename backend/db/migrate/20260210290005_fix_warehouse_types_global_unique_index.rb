# frozen_string_literal: true

# Fix: Drop global unique index on warehouse_types.code
#
# The global `index_warehouse_types_on_code` (unique on code alone) prevents
# multi-tenant sync because two tenants can't have the same code (e.g., "job").
# The tenant-scoped `idx_warehouse_types_tenant_code` (unique on tenant_id + code)
# is the correct constraint for a multi-tenant system.
class FixWarehouseTypesGlobalUniqueIndex < ActiveRecord::Migration[8.0]
  def up
    # Drop the global unique index (prevents cross-tenant code overlap)
    if index_exists?(:warehouse_types, :code, name: "index_warehouse_types_on_code")
      remove_index :warehouse_types, name: "index_warehouse_types_on_code"
    end

    # Add a non-unique index on code for query performance (if not exists)
    unless index_exists?(:warehouse_types, :code, name: "idx_warehouse_types_code")
      add_index :warehouse_types, :code, name: "idx_warehouse_types_code"
    end

    puts "[FixWarehouseTypesIndex] Replaced global unique code index with non-unique (tenant-scoped unique already exists)"
  end

  def down
    remove_index :warehouse_types, name: "idx_warehouse_types_code" if index_exists?(:warehouse_types, :code, name: "idx_warehouse_types_code")
    add_index :warehouse_types, :code, unique: true, name: "index_warehouse_types_on_code" unless index_exists?(:warehouse_types, :code, name: "index_warehouse_types_on_code")
  end
end
