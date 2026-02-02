# Rake task to seed legacy storage tabs on WarehouseFolder
# Created to avoid escaping issues with `!` in Heroku rails runner

namespace :warehouse_folder do
  desc "Seed legacy storage tabs for WarehouseFolder (SSoT for storage folder paths)"
  task seed_legacy_storage: :environment do
    puts "Seeding legacy storage tabs..."
    WarehouseFolder.seed_legacy_storage_tabs_only!
    puts "Done! WarehouseFolder.scope_base_folders now has #{WarehouseFolder.scope_base_folders.keys.count} entries"
  end
end
