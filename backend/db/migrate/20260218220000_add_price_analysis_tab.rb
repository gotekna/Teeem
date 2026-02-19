class AddPriceAnalysisTab < ActiveRecord::Migration[8.0]
  def up
    # Create Price Analysis tab under the "jobs" parent for all tenants.
    # Pattern: same as BOQ tab creation (20260216200007_fix_boq_tab_all_tenants.rb)
    ActsAsTenant.without_tenant do
      Tenant.find_each do |tenant|
        # Find the "jobs" root tab for this tenant
        jobs_tab = WarehouseFolder.find_by(
          tab_key: "jobs",
          parent_id: nil,
          tenant_id: tenant.id
        )
        next unless jobs_tab

        # Skip if already exists
        next if WarehouseFolder.exists?(tab_key: "price-analysis", tenant_id: tenant.id)

        WarehouseFolder.create!(
          tenant_id: tenant.id,
          warehouse_type_id: jobs_tab.warehouse_type_id,
          name: "Price Analysis",
          tab_key: "price-analysis",
          display_name: "Price Analysis",
          icon_name: "Scale",
          component_name: "JobPriceAnalysisTab",
          parent_id: jobs_tab.id,
          order_position: 3,  # After BOQ (2)
          enabled: true,
          is_system: true,
          tab_type: "system",
          tab_group: "data",
          warehouse_enabled: false  # Component tab, not a document folder
        )
        Rails.logger.info "Created Price Analysis tab for tenant #{tenant.id}"
      end
    end
  end

  def down
    ActsAsTenant.without_tenant do
      WarehouseFolder.where(tab_key: "price-analysis").destroy_all
    end
  end
end
