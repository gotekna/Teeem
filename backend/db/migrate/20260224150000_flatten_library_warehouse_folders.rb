# frozen_string_literal: true

# Fix: Library has a container root folder (library_root) while all other
# warehouse types (Jobs, Contacts, Corporate) have their folders at root level.
#
# Before: library_root (system, parent) → Standards, Guidelines, Manuals, etc. (children)
# After:  Standards, Guidelines, Manuals, etc. (root level, like Jobs/Contacts/Corporate)
#
class FlattenLibraryWarehouseFolders < ActiveRecord::Migration[7.2]
  def up
    # For each tenant, promote library children to root and remove the container
    tenant_ids = execute("SELECT id FROM tenants").map { |r| r["id"] }

    tenant_ids.each do |tenant_id|
      # Find the library_root container folder
      root_result = execute(<<-SQL.squish)
        SELECT wf.id FROM warehouse_folders wf
        JOIN warehouse_types wt ON wt.id = wf.warehouse_type_id
        WHERE wt.code = 'library'
          AND wt.tenant_id = #{tenant_id}
          AND wf.tab_key = 'library_root'
          AND wf.parent_id IS NULL
        LIMIT 1
      SQL
      next unless root_result.any?

      root_id = root_result.first["id"]

      # Promote children to root level (set parent_id = NULL)
      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET parent_id = NULL
        WHERE parent_id = #{root_id}
      SQL

      # Delete the container folder
      execute(<<-SQL.squish)
        DELETE FROM warehouse_folders WHERE id = #{root_id}
      SQL
    end
  end

  def down
    # Recreate the library_root container and re-parent children
    tenant_ids = execute("SELECT id FROM tenants").map { |r| r["id"] }

    tenant_ids.each do |tenant_id|
      library_type = execute(<<-SQL.squish)
        SELECT id FROM warehouse_types
        WHERE code = 'library' AND tenant_id = #{tenant_id}
        LIMIT 1
      SQL
      next unless library_type.any?

      library_type_id = library_type.first["id"]

      # Recreate root container
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

      # Re-parent all library folders under the container
      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET parent_id = #{root_id}
        WHERE warehouse_type_id = #{library_type_id}
          AND id != #{root_id}
          AND parent_id IS NULL
      SQL
    end
  end
end
