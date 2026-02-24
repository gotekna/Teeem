# frozen_string_literal: true

# Fix: Library WarehouseType and WarehouseFolders were created without tenant_id
# Root cause: Original migration used raw SQL INSERT without tenant_id column
# Fix: Delete orphaned records, create properly scoped per-tenant records
#
class FixLibraryWarehouseTypeTenantScoping < ActiveRecord::Migration[7.2]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: Clean up orphaned NULL-tenant records from original migration
    # ═══════════════════════════════════════════════════════════════════════════
    execute(<<-SQL.squish)
      DELETE FROM warehouse_folders
      WHERE warehouse_type_id IN (
        SELECT id FROM warehouse_types WHERE code = 'library' AND tenant_id IS NULL
      )
    SQL

    execute(<<-SQL.squish)
      DELETE FROM warehouse_types WHERE code = 'library' AND tenant_id IS NULL
    SQL

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: Create library WarehouseType + folders for each tenant
    # ═══════════════════════════════════════════════════════════════════════════
    tenant_ids = execute("SELECT id FROM tenants").map { |r| r["id"] }

    tenant_ids.each do |tenant_id|
      # Skip if this tenant already has a library type (idempotent)
      existing = execute(<<-SQL.squish)
        SELECT id FROM warehouse_types
        WHERE code = 'library' AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL
      next if existing.any?

      # Create WarehouseType
      wt_result = execute(<<-SQL.squish)
        INSERT INTO warehouse_types (tenant_id, code, display_name, icon_name, is_system, enabled, order_position, created_at, updated_at)
        VALUES (#{tenant_id}, 'library', 'Library', 'BookOpen', TRUE, TRUE, 14, NOW(), NOW())
        RETURNING id
      SQL
      library_type_id = wt_result.first["id"]

      # Create root folder
      root_result = execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          tenant_id, warehouse_type_id, name, tab_key, tab_type, tab_group,
          is_system, enabled, order_position, folder_segment,
          created_at, updated_at
        ) VALUES (
          #{tenant_id}, #{library_type_id}, 'Library', 'library_root', 'system', 'main',
          TRUE, TRUE, 0, 'Library',
          NOW(), NOW()
        )
        RETURNING id
      SQL
      root_id = root_result.first["id"]

      # Create child folders
      folders = [
        { name: "Standards",      tab_key: "standards",      icon: "BookCheck",     order: 1 },
        { name: "Guidelines",     tab_key: "guidelines",     icon: "ScrollText",    order: 2 },
        { name: "Manuals",        tab_key: "manuals",        icon: "BookText",      order: 3 },
        { name: "Templates",      tab_key: "templates",      icon: "FileTemplate",  order: 4 },
        { name: "Specifications", tab_key: "specifications", icon: "ClipboardList", order: 5 },
      ]

      folders.each do |folder|
        execute(<<-SQL.squish)
          INSERT INTO warehouse_folders (
            tenant_id, warehouse_type_id, parent_id, name, tab_key, tab_type, tab_group,
            is_system, enabled, order_position, folder_segment, icon_name,
            created_at, updated_at
          ) VALUES (
            #{tenant_id}, #{library_type_id}, #{root_id}, '#{folder[:name]}', '#{folder[:tab_key]}', 'document', 'documents',
            FALSE, TRUE, #{folder[:order]}, '#{folder[:name]}', '#{folder[:icon]}',
            NOW(), NOW()
          )
        SQL
      end
    end
  end

  def down
    # Remove all tenant-scoped library records
    execute(<<-SQL.squish)
      DELETE FROM warehouse_folders
      WHERE warehouse_type_id IN (
        SELECT id FROM warehouse_types WHERE code = 'library'
      )
    SQL
    execute("DELETE FROM warehouse_types WHERE code = 'library'")
  end
end
