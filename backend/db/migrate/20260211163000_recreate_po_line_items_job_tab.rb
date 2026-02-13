# frozen_string_literal: true

# Re-create "Purchase Order Lines" job tab as a sibling of Purchase Orders.
# If purchase-orders has a parent (e.g., "Jobs" group), nest under the same parent.
# Previously removed by 20260211161330, now restored with correct parent_id.
class RecreatePoLineItemsJobTab < ActiveRecord::Migration[7.2]
  def up
    job_type = execute("SELECT id FROM warehouse_types WHERE code = 'job' LIMIT 1").first
    unless job_type
      puts "  ⚠️  No 'job' warehouse_type found - skipping tab creation"
      return
    end
    job_type_id = job_type["id"]

    tenants = execute("SELECT id, name FROM tenants ORDER BY id")
    if tenants.none?
      puts "  ⚠️  No tenants found - skipping tab creation"
      return
    end

    tenants.each do |tenant|
      tenant_id = tenant["id"]
      tenant_name = tenant["name"]

      # Skip if already exists
      existing = execute(<<-SQL.squish).first
        SELECT id FROM warehouse_folders
        WHERE warehouse_type_id = #{job_type_id}
          AND tab_key = 'purchase-order-lines'
          AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL
      next if existing

      # Find the purchase-orders tab to match its parent and position
      po_tab = execute(<<-SQL.squish).first
        SELECT id, parent_id, order_position FROM warehouse_folders
        WHERE warehouse_type_id = #{job_type_id}
          AND tab_key = 'purchase-orders'
          AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL

      if po_tab
        parent_id = po_tab["parent_id"]
        new_position = po_tab["order_position"].to_i + 1

        # Shift existing siblings at this position and above to make room
        if parent_id
          execute(<<-SQL.squish)
            UPDATE warehouse_folders
            SET order_position = order_position + 1
            WHERE parent_id = #{parent_id}
              AND tenant_id = #{tenant_id}
              AND order_position >= #{new_position}
              AND tab_key != 'purchase-order-lines'
          SQL
        end

        parent_sql = parent_id ? parent_id.to_s : "NULL"
      else
        # No purchase-orders tab exists for this tenant - create as top-level
        parent_sql = "NULL"
        new_position = 8
      end

      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          warehouse_type_id, tenant_id, name, display_name, folder_segment,
          tab_key, tab_type, tab_group, icon_name,
          order_position, enabled, warehouse_enabled, is_system,
          parent_id, created_at, updated_at
        ) VALUES (
          #{job_type_id}, #{tenant_id}, 'Purchase Order Lines', 'Line Items', NULL,
          'purchase-order-lines', 'system', 'data', 'List',
          #{new_position}, TRUE, FALSE, FALSE,
          #{parent_sql}, NOW(), NOW()
        )
      SQL

      puts "  ✅ Created 'Line Items' tab for tenant: #{tenant_name} (parent_id=#{parent_sql}, position=#{new_position})"
    end
  end

  def down
    execute("DELETE FROM warehouse_folders WHERE tab_key = 'purchase-order-lines'")
  end
end
