# frozen_string_literal: true

# SSoT: Simplify tab_group to just 2 values (Feb 2026)
# - 'documents': User uploads files, Document Types enabled
# - 'data': System-generated content, no Document Types
#
# Converting: overview, reports, setup, main, system → data
class SimplifyWarehouseFolderTabGroups < ActiveRecord::Migration[8.0]
  def up
    # Convert all non-documents groups to 'data'
    execute <<-SQL.squish
      UPDATE warehouse_folders
      SET tab_group = 'data'
      WHERE tab_group IS NULL
         OR tab_group NOT IN ('documents', 'data')
    SQL

    # Log the change
    count = WarehouseFolder.where(tab_group: 'data').count
    puts "Converted #{count} warehouse folders to tab_group='data'"
  end

  def down
    # Cannot reverse - we don't know original values
    puts "Cannot reverse tab_group simplification - original values unknown"
  end
end
