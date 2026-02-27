# frozen_string_literal: true

# Add "Line Items" sub-tab back under the Estimating (jobs) primary tab.
# Previously deleted by 20260218170000; now re-added as a child of Estimating.
class AddLineItemsSubtabToEstimating < ActiveRecord::Migration[7.2]
  def up
    ActsAsTenant.without_tenant do
      job_type_id = execute("SELECT id FROM warehouse_types WHERE code = 'job' LIMIT 1").first&.fetch("id")
      unless job_type_id
        puts "  ⚠️  No 'job' warehouse_type found - skipping"
        return
      end

      WarehouseFolder.where(tab_key: "jobs").each do |estimating_tab|
        tenant_id = estimating_tab.tenant_id

        next if WarehouseFolder.find_by(tab_key: "purchase-order-lines", tenant_id: tenant_id)

        execute(<<-SQL.squish)
          UPDATE warehouse_folders
          SET order_position = order_position + 1, updated_at = NOW()
          WHERE parent_id = #{estimating_tab.id}
            AND tenant_id = #{tenant_id}
            AND order_position >= 1
        SQL

        execute(<<-SQL.squish)
          INSERT INTO warehouse_folders (
            warehouse_type_id, tenant_id, name, display_name, folder_segment,
            tab_key, tab_type, tab_group, icon_name,
            order_position, enabled, warehouse_enabled, is_system,
            parent_id, created_at, updated_at
          ) VALUES (
            #{job_type_id}, #{tenant_id}, 'Purchase Order Lines', 'Line Items', NULL,
            'purchase-order-lines', 'system', 'data', 'List',
            1, TRUE, FALSE, FALSE,
            #{estimating_tab.id}, NOW(), NOW()
          )
        SQL

        puts "  ✅ Added 'Line Items' sub-tab under Estimating for tenant #{tenant_id}"
      end
    end
  end

  def down
    execute("DELETE FROM warehouse_folders WHERE tab_key = 'purchase-order-lines'")
  end
end