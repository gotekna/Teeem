namespace :foundation_views do
  desc "Sync all foundation views with their database columns (add missing, remove extra)"
  task sync_all: :environment do
    puts "=== Syncing All Foundation Views ==="
    puts ""

    synced_foundations = 0
    synced_views = 0
    added_columns = 0
    removed_columns = 0

    Foundation.find_each do |foundation|
      all_columns = foundation.columns.pluck(:column_name)
      next if all_columns.empty?

      views = FoundationView.where(foundation_id: foundation.id)
      next if views.empty?

      foundation_had_changes = false

      views.each do |view|
        view_columns = view.columns["visible"]&.keys || []
        missing = all_columns - view_columns
        extra = view_columns - all_columns

        next if missing.empty? && extra.empty?

        unless foundation_had_changes
          puts "Foundation: #{foundation.name} (ID: #{foundation.id})"
          foundation_had_changes = true
          synced_foundations += 1
        end

        type = view.is_global ? "Global" : "Personal"
        puts "  Syncing view: #{view.name} (#{type})"

        # Add missing columns (default to hidden)
        if missing.any?
          puts "    Adding #{missing.count} missing columns: #{missing.join(', ')}"
          missing.each do |col|
            view.columns["visible"][col] = false
            # Add to end of order array if not present
            unless view.columns["order"]&.include?(col)
              view.columns["order"] ||= []
              view.columns["order"] << col
            end
          end
          added_columns += missing.count
        end

        # Remove extra columns that don't exist in DB
        if extra.any?
          puts "    Removing #{extra.count} extra columns: #{extra.join(', ')}"
          extra.each do |col|
            view.columns["visible"].delete(col)
            view.columns["order"]&.delete(col)
            view.columns["widths"]&.delete(col)
          end
          removed_columns += extra.count
        end

        # Skip validation to avoid issues with orphaned personal views that have nil user_id
        view.save!(validate: false)
        synced_views += 1
      end

      puts "" if foundation_had_changes
    end

    puts "=== Summary ==="
    puts "Foundations synced: #{synced_foundations}"
    puts "Views synced: #{synced_views}"
    puts "Columns added: #{added_columns}"
    puts "Columns removed: #{removed_columns}"
  end

  desc "Sync views for a specific foundation by name"
  task :sync_foundation, [ :foundation_name ] => :environment do |t, args|
    foundation_name = args[:foundation_name]

    if foundation_name.blank?
      puts "Usage: bin/rails foundation_views:sync_foundation[FoundationName]"
      puts "Example: bin/rails foundation_views:sync_foundation[Jobs]"
      exit 1
    end

    foundation = Foundation.find_by(name: foundation_name)
    unless foundation
      puts "Error: Foundation '#{foundation_name}' not found"
      puts ""
      puts "Available foundations:"
      Foundation.order(:name).pluck(:name).each { |n| puts "  - #{n}" }
      exit 1
    end

    puts "=== Syncing Views for #{foundation.name} ==="
    puts ""

    all_columns = foundation.columns.pluck(:column_name)
    if all_columns.empty?
      puts "No columns found for this foundation"
      exit 0
    end

    views = FoundationView.where(foundation_id: foundation.id)
    if views.empty?
      puts "No views found for this foundation"
      exit 0
    end

    synced_views = 0
    added_columns = 0
    removed_columns = 0

    views.each do |view|
      view_columns = view.columns["visible"]&.keys || []
      missing = all_columns - view_columns
      extra = view_columns - all_columns

      next if missing.empty? && extra.empty?

      type = view.is_global ? "Global" : "Personal"
      puts "View: #{view.name} (#{type}, ID: #{view.id})"

      # Add missing columns (default to hidden)
      if missing.any?
        puts "  Adding #{missing.count} missing columns:"
        missing.each { |col| puts "    + #{col}" }
        missing.each do |col|
          view.columns["visible"][col] = false
          unless view.columns["order"]&.include?(col)
            view.columns["order"] ||= []
            view.columns["order"] << col
          end
        end
        added_columns += missing.count
      end

      # Remove extra columns
      if extra.any?
        puts "  Removing #{extra.count} extra columns:"
        extra.each { |col| puts "    - #{col}" }
        extra.each do |col|
          view.columns["visible"].delete(col)
          view.columns["order"]&.delete(col)
          view.columns["widths"]&.delete(col)
        end
        removed_columns += extra.count
      end

      # Skip validation to avoid issues with orphaned personal views that have nil user_id
      view.save!(validate: false)
      synced_views += 1
      puts ""
    end

    puts "=== Summary for #{foundation.name} ==="
    puts "Views synced: #{synced_views}/#{views.count}"
    puts "Columns added: #{added_columns}"
    puts "Columns removed: #{removed_columns}"
  end

  desc "Check which foundations need view syncing (dry run)"
  task check: :environment do
    puts "=== Checking Foundations for View Sync Issues ==="
    puts ""

    needs_sync = []

    Foundation.find_each do |foundation|
      all_columns = foundation.columns.pluck(:column_name)
      next if all_columns.empty?

      views = FoundationView.where(foundation_id: foundation.id)
      next if views.empty?

      mismatched_views = views.select do |view|
        view_columns = view.columns["visible"]&.keys || []
        view_columns.count != all_columns.count
      end

      if mismatched_views.any?
        needs_sync << {
          foundation: foundation,
          total_views: views.count,
          mismatched_views: mismatched_views.count
        }
      end
    end

    if needs_sync.empty?
      puts "✓ All foundations are in sync!"
    else
      puts "Found #{needs_sync.count} foundations that need syncing:"
      puts ""
      needs_sync.each do |item|
        puts "  #{item[:foundation].name}"
        puts "    Mismatched views: #{item[:mismatched_views]}/#{item[:total_views]}"
      end
      puts ""
      puts "Run 'bin/rails foundation_views:sync_all' to fix all issues"
    end
  end
end
