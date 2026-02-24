# frozen_string_literal: true

# Migration: Add Library section
#
# Creates:
# 1. WarehouseType record: code="library", display_name="Library"
# 2. NavigationItem: name="Library", href="/library", icon="BookOpen"
# 3. Root WarehouseFolder for library type (parent container)
# 4. Initial child folders: Standards, Guidelines, Manuals, Templates, Specifications
#
class AddLibraryWarehouseTypeAndNavigation < ActiveRecord::Migration[7.2]
  def up
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: Create WarehouseType record for Library
    # ═══════════════════════════════════════════════════════════════════════════
    result = execute(<<-SQL.squish)
      INSERT INTO warehouse_types (code, display_name, icon_name, is_system, enabled, order_position, created_at, updated_at)
      VALUES ('library', 'Library', 'BookOpen', TRUE, TRUE, 14, NOW(), NOW())
      ON CONFLICT (tenant_id, code)
      DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id
    SQL
    library_type_id = result.first["id"]

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: Create NavigationItem for Library
    # Position after Documents (14), before Workflows (15)
    # ═══════════════════════════════════════════════════════════════════════════

    # Shift existing items at position >= 15 to make room
    execute(<<-SQL.squish)
      UPDATE navigation_items
      SET position = position + 1
      WHERE position >= 15
    SQL

    NavigationItem.find_or_create_by!(href: "/library") do |item|
      item.name = "Library"
      item.icon = "BookOpen"
      item.position = 15
      item.is_active = true
      item.visible_to_roles = []
    end

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: Create root WarehouseFolder for library
    # ═══════════════════════════════════════════════════════════════════════════
    root_result = execute(<<-SQL.squish)
      INSERT INTO warehouse_folders (
        warehouse_type_id, name, tab_key, tab_type, tab_group,
        is_system, enabled, order_position, folder_segment,
        created_at, updated_at
      ) VALUES (
        #{library_type_id}, 'Library', 'library_root', 'system', 'main',
        TRUE, TRUE, 0, 'Library',
        NOW(), NOW()
      )
      RETURNING id
    SQL
    root_id = root_result.first["id"]

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 4: Create initial child folders
    # ═══════════════════════════════════════════════════════════════════════════
    folders = [
      { name: "Standards",      tab_key: "standards",      icon: "BookCheck",    order: 1 },
      { name: "Guidelines",     tab_key: "guidelines",     icon: "ScrollText",   order: 2 },
      { name: "Manuals",        tab_key: "manuals",        icon: "BookText",     order: 3 },
      { name: "Templates",      tab_key: "templates",      icon: "FileTemplate", order: 4 },
      { name: "Specifications", tab_key: "specifications", icon: "ClipboardList", order: 5 },
    ]

    folders.each do |folder|
      execute(<<-SQL.squish)
        INSERT INTO warehouse_folders (
          warehouse_type_id, parent_id, name, tab_key, tab_type, tab_group,
          is_system, enabled, order_position, folder_segment, icon_name,
          created_at, updated_at
        ) VALUES (
          #{library_type_id}, #{root_id}, '#{folder[:name]}', '#{folder[:tab_key]}', 'document', 'documents',
          FALSE, TRUE, #{folder[:order]}, '#{folder[:name]}', '#{folder[:icon]}',
          NOW(), NOW()
        )
      SQL
    end
  end

  def down
    # Remove child folders and root folder
    library_type = execute("SELECT id FROM warehouse_types WHERE code = 'library' LIMIT 1")
    if library_type.any?
      library_type_id = library_type.first["id"]
      execute("DELETE FROM warehouse_folders WHERE warehouse_type_id = #{library_type_id}")
    end

    # Remove warehouse type
    execute("DELETE FROM warehouse_types WHERE code = 'library'")

    # Remove navigation item
    NavigationItem.find_by(href: "/library")&.destroy

    # Shift positions back
    execute(<<-SQL.squish)
      UPDATE navigation_items
      SET position = position - 1
      WHERE position >= 15
    SQL
  end
end
