# DEPRECATED (Feb 2026): This task is no longer needed
# warehouse_folders column has been removed from warehouse_providers
# Folder paths are now stored per-tab in warehouse_folders table (SSoT)
#
# See: WarehouseProvider::DEFAULT_WAREHOUSE_FOLDERS for base templates
# See: warehouse_folders.warehouse_folder for per-tab complete paths

namespace :sync_storage_config do
  desc "DEPRECATED: Show current storage configuration"
  task show: :environment do
    puts "DEPRECATED: warehouse_folders column removed from warehouse_providers"
    puts "SSoT is now WarehouseProvider::DEFAULT_WAREHOUSE_FOLDERS constant"
    puts "\nDefault warehouse folders:"
    puts WarehouseProvider::DEFAULT_WAREHOUSE_FOLDERS.to_yaml
  end

  desc "DEPRECATED: Apply storage configuration (no longer needed)"
  task apply: :environment do
    puts "DEPRECATED: This task is no longer needed"
    puts "warehouse_folders column has been removed from warehouse_providers"
    puts "Folder paths are now stored per-tab in warehouse_folders table"
    puts "\nTo update tab paths, modify the warehouse_folder column on individual WarehouseFolder records"
  end
end
