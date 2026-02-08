# frozen_string_literal: true

# Migration: Add "Warehouse" tab to Job, Contact, and Corporate entity pages
#
# Creates WarehouseFolder records with tab_key='warehouse' for each entity scope.
# These are view-only tabs (warehouse_enabled=false) that render ScopedWarehouseView
# on the frontend, showing the scoped warehouse tree for each record.
#
# The frontend components (ScopedWarehouseView, tab content rendering) already exist -
# this migration just creates the database records that trigger the tab to appear.
#
class AddWarehouseTabsToEntityPages < ActiveRecord::Migration[7.2]
  def up
    # Look up warehouse_type IDs by code (IDs are environment-specific)
    job_type = execute("SELECT id FROM warehouse_types WHERE code = 'job' LIMIT 1").first
    contact_type = execute("SELECT id FROM warehouse_types WHERE code = 'contact' LIMIT 1").first
    corporate_type = execute("SELECT id FROM warehouse_types WHERE code = 'corporate' LIMIT 1").first

    # Get tenant_id (Tekna - the only tenant with warehouse config)
    tenant = execute("SELECT id FROM tenants LIMIT 1").first
    tenant_id = tenant&.fetch("id", nil)

    unless tenant_id
      puts "[AddWarehouseTabsToEntityPages] No tenant found - skipping"
      return
    end

    [
      { type_id: job_type&.fetch("id", nil),       code: "job",       order: 20 },
      { type_id: contact_type&.fetch("id", nil),   code: "contact",   order: 12 },
      { type_id: corporate_type&.fetch("id", nil), code: "corporate", order: 22 },
    ].each do |config|
      next unless config[:type_id]

      # Idempotent: skip if already exists
      existing = execute(<<-SQL.squish).first
        SELECT id FROM warehouse_folders
        WHERE warehouse_type_id = #{config[:type_id]}
          AND tab_key = 'warehouse'
          AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL
      next if existing

      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          warehouse_type_id, tenant_id, name, display_name, folder_segment,
          tab_key, tab_type, tab_group, icon_name,
          order_position, enabled, warehouse_enabled, is_system,
          parent_id, created_at, updated_at
        ) VALUES (
          #{config[:type_id]}, #{tenant_id}, 'Warehouse', 'Warehouse', 'Warehouse',
          'warehouse', 'system', 'data', 'Warehouse',
          #{config[:order]}, TRUE, FALSE, FALSE,
          NULL, NOW(), NOW()
        )
      SQL

      puts "[AddWarehouseTabsToEntityPages] Created Warehouse tab for #{config[:code]}"
    end
  end

  def down
    execute(<<-SQL.squish)
      DELETE FROM warehouse_folders
      WHERE tab_key = 'warehouse'
        AND display_name = 'Warehouse'
        AND tab_type = 'system'
        AND warehouse_enabled = FALSE
    SQL
  end
end
