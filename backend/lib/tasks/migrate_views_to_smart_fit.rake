namespace :views do
  desc "Migrate all saved views to TEEEM Smart fit mode"
  task migrate_to_smart_fit: :environment do
    puts "Starting migration of saved views to TEEEM Smart fit..."

    total = SavedView.count
    updated = 0

    SavedView.find_each do |view|
      # Set smart_fit to true
      view.update_column(:smart_fit, true)

      # Turn off auto_fit_columns if it was on
      if view.columns.is_a?(Hash) && view.columns['autoFitColumns']
        view.columns['autoFitColumns'] = false
        view.save
      end

      updated += 1
      print "\rMigrated #{updated}/#{total} views..." if updated % 10 == 0
    end

    puts "\n✅ Successfully migrated #{updated} views to TEEEM Smart fit"
  end
end
