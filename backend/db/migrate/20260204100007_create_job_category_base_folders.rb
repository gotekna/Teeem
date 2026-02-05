# frozen_string_literal: true

# Migration: Create base_folders for job document categories
#
# Each major job tab category (Plans, Sales, PreCon, Photo, etc.) gets its own
# BaseFolder under the "job" warehouse_type. WarehouseFolders (tabs) then link
# to their matching base_folder.
#
# Hierarchy:
#   WarehouseType: job
#   ├── BaseFolder: Plans → WarehouseFolder: Plans (and children)
#   ├── BaseFolder: Sales → WarehouseFolder: Sales (and children)
#   ├── BaseFolder: PreCon → WarehouseFolder: PreCon (and children)
#   ├── BaseFolder: Photo → WarehouseFolder: Photo (and children)
#   └── BaseFolder: Jobs (default/general for any not matching)
#
class CreateJobCategoryBaseFolders < ActiveRecord::Migration[7.2]
  def up
    # Get the job warehouse_type
    job_type_result = execute("SELECT id FROM warehouse_types WHERE code = 'job'")
    return puts "[CreateJobCategoryBaseFolders] job warehouse_type not found" if job_type_result.count.zero?

    job_type_id = job_type_result.first["id"]

    # Get all root job warehouse_folders (these become base_folders)
    root_folders_result = execute(<<-SQL.squish)
      SELECT id, display_name, folder_path, download_name, ui_name, is_system_tab, enabled, order_position
      FROM warehouse_folders
      WHERE warehouse_type = 'job' AND parent_id IS NULL
      ORDER BY order_position
    SQL

    created_count = 0
    updated_count = 0

    root_folders_result.each do |row|
      folder_name = row["display_name"]
      folder_path_template = row["folder_path"] || "Jobs/{{JobCode}}/#{folder_name}"

      # Check if base_folder already exists for this name
      existing = execute(<<-SQL.squish)
        SELECT id FROM base_folders
        WHERE warehouse_type_id = #{job_type_id} AND name = '#{folder_name.gsub("'", "''")}'
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
            #{job_type_id},
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
        puts "[CreateJobCategoryBaseFolders] Created base_folder: #{folder_name} (id: #{base_folder_id})"
      else
        base_folder_id = existing.first["id"]
        puts "[CreateJobCategoryBaseFolders] Base folder already exists: #{folder_name} (id: #{base_folder_id})"
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

    puts "[CreateJobCategoryBaseFolders] Created #{created_count} new base_folders"
    puts "[CreateJobCategoryBaseFolders] Updated #{updated_count} warehouse_folder trees"

    # Verify final counts
    bf_count = execute("SELECT COUNT(*) FROM base_folders WHERE warehouse_type_id = #{job_type_id}").first["count"]
    puts "[CreateJobCategoryBaseFolders] Total job base_folders: #{bf_count}"
  end

  def down
    # Get job warehouse_type
    job_type_result = execute("SELECT id FROM warehouse_types WHERE code = 'job'")
    return if job_type_result.count.zero?

    job_type_id = job_type_result.first["id"]

    # Get the "Jobs" base_folder (the original one)
    jobs_bf = execute("SELECT id FROM base_folders WHERE warehouse_type_id = #{job_type_id} AND name = 'Jobs'")
    return if jobs_bf.count.zero?

    jobs_bf_id = jobs_bf.first["id"]

    # Reset all job warehouse_folders to link to the generic "Jobs" base_folder
    execute("UPDATE warehouse_folders SET base_folder_id = #{jobs_bf_id} WHERE warehouse_type = 'job'")

    # Delete all job base_folders except "Jobs"
    execute("DELETE FROM base_folders WHERE warehouse_type_id = #{job_type_id} AND name != 'Jobs'")
  end
end
