# Rake task to seed legacy storage tabs on EntityTab
# Created to avoid escaping issues with `!` in Heroku rails runner

namespace :entity_tab do
  desc "Seed legacy storage tabs for EntityTab (SSoT for storage folder paths)"
  task seed_legacy_storage: :environment do
    puts "Seeding legacy storage tabs..."
    EntityTab.seed_legacy_storage_tabs_only!
    puts "Done! EntityTab.scope_base_folders now has #{EntityTab.scope_base_folders.keys.count} entries"
  end
end
