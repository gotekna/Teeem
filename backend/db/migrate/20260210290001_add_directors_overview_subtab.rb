# frozen_string_literal: true

# Add Directors overview sub-tab to corporate entities (multi-tenant safe)
# This enables the DirectorsTab component (with Director Changes wizard)
# to appear as a sub-tab under Overview for Company, Charity, and Superfund entities.
class AddDirectorsOverviewSubtab < ActiveRecord::Migration[8.0]
  def up
    # Find the corporate warehouse_type
    corporate_type = execute(<<-SQL.squish).first
      SELECT id FROM warehouse_types WHERE code = 'corporate' LIMIT 1
    SQL
    return puts "[AddDirectorsSubtab] Corporate warehouse_type not found" unless corporate_type

    type_id = corporate_type["id"]

    # Create for ALL tenants
    tenants = execute("SELECT id, name FROM tenants ORDER BY id")

    if tenants.none?
      puts "[AddDirectorsSubtab] No tenants found - skipping"
      return
    end

    tenants.each do |tenant|
      tenant_id = tenant["id"]
      tenant_name = tenant["name"]

      # Find the Overview parent tab for this tenant
      overview_parent = execute(<<-SQL.squish).first
        SELECT id FROM warehouse_folders
        WHERE warehouse_type_id = #{type_id}
          AND tab_key = 'overview'
          AND parent_id IS NULL
          AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL

      unless overview_parent
        puts "[AddDirectorsSubtab] No corporate Overview parent for tenant #{tenant_name} - skipping"
        next
      end

      parent_id = overview_parent["id"]

      # Idempotent: skip if already exists for this tenant
      existing = execute(<<-SQL.squish).first
        SELECT id FROM warehouse_folders
        WHERE warehouse_type_id = #{type_id}
          AND tab_key = 'directors'
          AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL

      if existing
        puts "[AddDirectorsSubtab] Directors sub-tab already exists for tenant #{tenant_name}"
        next
      end

      # Get the highest order_position among overview sub-tabs for this parent
      max_order = execute(<<-SQL.squish).first
        SELECT COALESCE(MAX(order_position), 0) as max_pos
        FROM warehouse_folders
        WHERE parent_id = #{parent_id}
          AND tab_group = 'overview'
      SQL
      next_order = (max_order["max_pos"].to_i + 10)

      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          warehouse_type_id, tenant_id, name, folder_segment, tab_key, display_name,
          tab_group, tab_type, icon_name, component_name,
          entity_filters, parent_id, is_system, enabled,
          order_position, warehouse_enabled,
          created_at, updated_at
        ) VALUES (
          #{type_id}, #{tenant_id}, 'Directors', 'directors', 'directors', 'Directors',
          'overview', 'system', 'Users', 'DirectorsTab',
          ARRAY['Company', 'Charity', 'Superfund']::varchar[],
          #{parent_id}, true, true,
          #{next_order}, false,
          NOW(), NOW()
        )
      SQL

      puts "[AddDirectorsSubtab] Created Directors sub-tab for tenant #{tenant_name}"
    end
  end

  def down
    execute(<<-SQL.squish)
      DELETE FROM warehouse_folders
      WHERE tab_key = 'directors'
        AND tab_group = 'overview'
        AND warehouse_type_id = (SELECT id FROM warehouse_types WHERE code = 'corporate' LIMIT 1)
    SQL
  end
end
