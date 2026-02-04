# frozen_string_literal: true

# Migration: Create base_folders for contact and corporate document categories
#
# Same pattern as jobs - each root tab gets its own BaseFolder.
#
class CreateContactAndCorporateBaseFolders < ActiveRecord::Migration[7.2]
  def up
    create_base_folders_for_warehouse_type("contact")
    create_base_folders_for_warehouse_type("corporate")
  end

  def down
    rollback_base_folders_for_warehouse_type("contact", "Contacts")
    rollback_base_folders_for_warehouse_type("corporate", "Corporate")
  end

  private

  def create_base_folders_for_warehouse_type(warehouse_type_code)
    # Get the warehouse_type
    type_result = execute("SELECT id FROM warehouse_types WHERE code = '#{warehouse_type_code}'")
    return puts "[CreateBaseFolders] #{warehouse_type_code} warehouse_type not found" if type_result.count.zero?

    type_id = type_result.first["id"]

    # Get all root warehouse_folders for this type
    root_folders_result = execute(<<-SQL.squish)
      SELECT id, display_name, folder_path, download_name, ui_name, is_system_tab, enabled, order_position
      FROM warehouse_folders
      WHERE warehouse_type = '#{warehouse_type_code}' AND parent_id IS NULL
      ORDER BY order_position
    SQL

    created_count = 0
    updated_count = 0

    # Determine the base path prefix
    base_path_prefix = case warehouse_type_code
    when "contact" then "Contacts/{{ContactName}}"
    when "corporate" then "Corporate/{{CompanyGroup}}/{{CompanyCode}}"
    else warehouse_type_code.titleize
    end

    root_folders_result.each do |row|
      folder_name = row["display_name"]
      folder_path_template = row["folder_path"] || "#{base_path_prefix}/#{folder_name}"

      # Check if base_folder already exists for this name
      existing = execute(<<-SQL.squish)
        SELECT id FROM base_folders
        WHERE warehouse_type_id = #{type_id} AND name = '#{folder_name.gsub("'", "''")}'
      SQL

      base_folder_id = nil

      if existing.count.zero?
        # Create the base_folder
        result = execute(<<-SQL.squish)
          INSERT INTO base_folders (
            warehouse_type_id,
            name,
            folder_path_template,
            download_name_template,
            ui_name_template,
            is_system,
            enabled,
            order_position,
            created_at,
            updated_at
          )
          VALUES (
            #{type_id},
            '#{folder_name.gsub("'", "''")}',
            '#{folder_path_template.gsub("'", "''")}',
            #{row["download_name"] ? "'#{row["download_name"].gsub("'", "''")}'" : "NULL"},
            #{row["ui_name"] ? "'#{row["ui_name"].gsub("'", "''")}'" : "NULL"},
            #{row["is_system_tab"] || false},
            #{row["enabled"] != false},
            #{row["order_position"] || 0},
            NOW(),
            NOW()
          )
          RETURNING id
        SQL
        base_folder_id = result.first["id"]
        created_count += 1
      else
        base_folder_id = existing.first["id"]
      end

      # Update this warehouse_folder AND its children to link to this base_folder
      execute(<<-SQL.squish)
        WITH RECURSIVE descendants AS (
          SELECT id FROM warehouse_folders WHERE id = #{row["id"]}
          UNION ALL
          SELECT wf.id FROM warehouse_folders wf
          INNER JOIN descendants d ON wf.parent_id = d.id
        )
        UPDATE warehouse_folders
        SET base_folder_id = #{base_folder_id}
        WHERE id IN (SELECT id FROM descendants)
      SQL
      updated_count += 1
    end

    puts "[CreateBaseFolders] #{warehouse_type_code}: Created #{created_count} base_folders, updated #{updated_count} folder trees"
  end

  def rollback_base_folders_for_warehouse_type(warehouse_type_code, default_folder_name)
    type_result = execute("SELECT id FROM warehouse_types WHERE code = '#{warehouse_type_code}'")
    return if type_result.count.zero?

    type_id = type_result.first["id"]

    # Get the default base_folder
    default_bf = execute("SELECT id FROM base_folders WHERE warehouse_type_id = #{type_id} AND name = '#{default_folder_name}'")
    return if default_bf.count.zero?

    default_bf_id = default_bf.first["id"]

    # Reset all warehouse_folders to link to the default base_folder
    execute("UPDATE warehouse_folders SET base_folder_id = #{default_bf_id} WHERE warehouse_type = '#{warehouse_type_code}'")

    # Delete all base_folders except the default
    execute("DELETE FROM base_folders WHERE warehouse_type_id = #{type_id} AND name != '#{default_folder_name}'")
  end
end
