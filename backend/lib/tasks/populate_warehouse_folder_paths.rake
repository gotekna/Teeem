# frozen_string_literal: true

# SSoT (Feb 2026): warehouse_folders table is THE ONE source of truth
# This task populates missing warehouse_folder paths by copying from existing data
# NO hardcoded defaults - reads from database only

namespace :warehouse do
  desc "Show current warehouse_folder paths for all tabs (SSoT from database)"
  task show_folder_paths: :environment do
    puts "=" * 60
    puts "Warehouse folder paths (SSoT: warehouse_folders table)"
    puts "=" * 60

    WarehouseFolder.distinct.pluck(:warehouse_type).sort.each do |warehouse_type|
      puts "\n--- #{warehouse_type} ---"
      WarehouseFolder.where(warehouse_type: warehouse_type)
                     .where.not(folder_path: [nil, ''])
                     .order(:parent_id, :order_position)
                     .each do |tab|
        indent = tab.parent_id ? "  " : ""
        puts "#{indent}#{tab.display_name}: #{tab.folder_path}"
      end
    end
  end

  desc "List tabs missing folder_path"
  task missing_folder_paths: :environment do
    puts "=" * 60
    puts "Tabs missing folder_path"
    puts "=" * 60

    missing = WarehouseFolder.where(folder_path: [nil, ''])
                             .order(:warehouse_type, :parent_id, :order_position)

    if missing.empty?
      puts "✅ All tabs have folder_path set"
    else
      puts "Found #{missing.count} tabs without folder_path:"
      missing.each do |tab|
        puts "  [#{tab.warehouse_type}] #{tab.display_name} (id: #{tab.id})"
      end
    end
  end

  desc "DEPRECATED: populate_folder_paths - paths should be set via admin UI"
  task populate_folder_paths: :environment do
    puts "DEPRECATED: This task is no longer needed"
    puts ""
    puts "SSoT (Feb 2026): warehouse_folders table is THE ONE source of truth"
    puts "Path templates should be set via the admin UI at:"
    puts "  /settings/company/warehouse-config/warehouse_folders"
    puts ""
    puts "To see current paths: rails warehouse:show_folder_paths"
    puts "To find missing paths: rails warehouse:missing_folder_paths"
  end
end
