# frozen_string_literal: true

# FRC (Mar 2026): `notebook` source_type had no WarehouseType mapping.
# WarehousePathComputer fell back to "unassigned" for notebook docs, meaning
# any notebook doc created without an explicit folder_path would get a nil path.
# The 3 existing notebook docs were safe only because they had explicit folder_path: "Notes".
#
# Fix: Create a proper WarehouseType + root WarehouseFolder for notebooks,
# so WarehousePathComputer can resolve them correctly to "Notes/...".
class AddNotebookWarehouseType < ActiveRecord::Migration[7.1]
  def up
    # Create WarehouseType for each tenant (warehouse_types are tenant-scoped)
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        # Skip if already exists
        next if WarehouseType.exists?(code: "notebook")

        wt = WarehouseType.create!(
          code: "notebook",
          display_name: "Notebook",
          icon_name: "BookOpen",
          is_system: true,
          enabled: true,
          order_position: 15,
          folder_path_template: "Notes"
        )

        # No root WarehouseFolder needed — same pattern as library WT.
        # The folder_path_template ("Notes") provides the root prefix.
        # Existing notebook docs have explicit folder_path: "Notes" and won't be recomputed.
        # Future notebook docs with warehouse_folder_id use that folder's full_folder_path.

        puts "Created notebook WarehouseType for tenant #{tenant.id}"
      end
    end
  end

  def down
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        wt = WarehouseType.find_by(code: "notebook")
        if wt
          WarehouseFolder.where(warehouse_type: wt).destroy_all
          wt.destroy
        end
      end
    end
  end
end
