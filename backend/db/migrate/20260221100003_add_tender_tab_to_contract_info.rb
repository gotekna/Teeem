# frozen_string_literal: true

# Add "Tender" tab as a child of "Contract Info" parent in the job warehouse folders.
# This makes the Tender tab visible in the job detail page under Contract Info.
#
# The frontend already has JobTenderTab component registered with tab_key "tender"
# in JOB_TAB_COMPONENTS and COMPONENT_BY_NAME maps.
class AddTenderTabToContractInfo < ActiveRecord::Migration[8.0]
  def up
    ActsAsTenant.without_tenant do
      Tenant.find_each do |tenant|
        # Find the "Contract Info" parent tab (tab_key = "contract-info")
        contract_info_tab = WarehouseFolder.find_by(
          tab_key: "contract-info",
          tenant_id: tenant.id
        )

        # Fallback: search by name if tab_key doesn't match
        contract_info_tab ||= WarehouseFolder.find_by(
          name: "Contract Info",
          tenant_id: tenant.id
        )

        unless contract_info_tab
          Rails.logger.warn "No 'Contract Info' tab found for tenant #{tenant.id}, skipping"
          next
        end

        # Skip if already exists
        next if WarehouseFolder.exists?(tab_key: "tender", tenant_id: tenant.id)

        # Find the highest order_position among existing children
        max_order = contract_info_tab.children.maximum(:order_position) || 0

        WarehouseFolder.create!(
          tenant_id: tenant.id,
          warehouse_type_id: contract_info_tab.warehouse_type_id,
          name: "Tender",
          tab_key: "tender",
          display_name: "Tender",
          folder_segment: "Tender",
          icon_name: "FileSignature",
          component_name: "JobTenderTab",
          parent_id: contract_info_tab.id,
          order_position: max_order + 1,
          enabled: true,
          is_system: false,
          tab_type: "system",
          tab_group: "data",
          warehouse_enabled: false  # Component tab, not a document folder
        )
        Rails.logger.info "Created Tender tab under Contract Info for tenant #{tenant.id}"
      end
    end
  end

  def down
    ActsAsTenant.without_tenant do
      WarehouseFolder.where(tab_key: "tender", component_name: "JobTenderTab").destroy_all
    end
  end
end
