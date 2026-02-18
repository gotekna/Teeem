class FixBoqTabAllTenants < ActiveRecord::Migration[8.0]
  def up
    # Previous migrations filtered by warehouse_type_id which only matched tenant 2.
    # Tenants 1 and 3 have different warehouse_type IDs. Match by tenant_id instead.
    ActsAsTenant.without_tenant do
      WarehouseFolder.where(tab_key: "boq").find_each do |boq_tab|
        # Find the "jobs" root tab for the SAME tenant
        jobs_tab = WarehouseFolder.find_by(
          tab_key: "jobs",
          parent_id: nil,
          tenant_id: boq_tab.tenant_id
        )
        next unless jobs_tab
        next if boq_tab.parent_id == jobs_tab.id # Already correct

        boq_tab.update_columns(
          parent_id: jobs_tab.id,
          order_position: 2
        )
        Rails.logger.info "Moved BOQ tab (id=#{boq_tab.id}) under Jobs (id=#{jobs_tab.id}) for tenant #{boq_tab.tenant_id}"
      end
    end
  end

  def down
    # No-op
  end
end
