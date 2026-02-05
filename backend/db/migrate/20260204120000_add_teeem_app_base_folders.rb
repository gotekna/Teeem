# frozen_string_literal: true

# Migration: Add TeeemXL, TeeemWord, TeeemPowerPoint base folders under Warehouse type
#
# SSoT (Feb 2026): These are the storage locations for Teeem's built-in apps:
# - TeeemXL: User-created spreadsheets (teeem_spreadsheets table)
# - TeeemWord: User-created documents (teeem_documents table)
# - TeeemPowerPoint: User-created presentations (teeem_presentations table)
#
# All stored under: Warehousing/{AppName}
#
class AddTeeemAppBaseFolders < ActiveRecord::Migration[7.2]
  def up
    # Get the warehouse type ID
    warehouse_type = execute("SELECT id FROM warehouse_types WHERE code = 'warehouse' LIMIT 1").first
    return unless warehouse_type

    warehouse_type_id = warehouse_type["id"]

    # Define the Teeem app base folders
    teeem_apps = [
      { name: "TeeemXL", folder_path_template: "TeeemXL", order: 2 },
      { name: "TeeemWord", folder_path_template: "TeeemWord", order: 3 },
      { name: "TeeemPowerPoint", folder_path_template: "TeeemPowerPoint", order: 4 },
    ]

    teeem_apps.each do |app|
      execute(<<-SQL.squish)
        INSERT INTO base_folders (
          warehouse_type_id,
          name,
          folder_path_template,
          is_system,
          enabled,
          order_position,
          created_at,
          updated_at
        )
        VALUES (
          #{warehouse_type_id},
          '#{app[:name]}',
          '#{app[:folder_path_template]}',
          TRUE,
          TRUE,
          #{app[:order]},
          NOW(),
          NOW()
        )
        ON CONFLICT (warehouse_type_id, name) DO NOTHING
      SQL
    end

    puts "[AddTeeemAppBaseFolders] Added TeeemXL, TeeemWord, TeeemPowerPoint base folders under Warehouse type"
  end

  def down
    execute(<<-SQL.squish)
      DELETE FROM base_folders
      WHERE name IN ('TeeemXL', 'TeeemWord', 'TeeemPowerPoint')
        AND warehouse_type_id = (SELECT id FROM warehouse_types WHERE code = 'warehouse' LIMIT 1)
    SQL
  end
end
