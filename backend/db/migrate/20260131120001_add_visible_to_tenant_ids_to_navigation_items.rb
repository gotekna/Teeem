class AddVisibleToTenantIdsToNavigationItems < ActiveRecord::Migration[7.1]
  def change
    # Add tenant-based visibility to navigation items
    # Empty array = visible to all tenants (default)
    # [1] = visible only to tenant 1 (TEEEM)
    # [1, 2, 3] = visible to specific tenants
    add_column :navigation_items, :visible_to_tenant_ids, :bigint, array: true, default: []
    add_index :navigation_items, :visible_to_tenant_ids, using: :gin
  end
end
