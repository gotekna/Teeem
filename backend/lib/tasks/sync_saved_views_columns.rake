namespace :views do
  desc "Sync all saved views' columns with actual table columns (add missing, remove deleted)"
  task sync_columns: :environment do
    puts "=" * 60
    puts "Syncing saved views columns with actual table columns"
    puts "=" * 60

    total_views = 0
    updated_views = 0
    added_columns = 0
    removed_columns = 0

    # Get all foundations with saved views
    foundations_with_views = Foundation.joins("INNER JOIN foundation_views ON foundation_views.foundation_id = foundations.id")
                                       .distinct

    foundations_with_views.each do |foundation|
      # Get actual column names for this foundation
      actual_columns = foundation.columns.pluck(:column_name)

      # Always include system columns
      system_columns = [ "id", "created_at", "updated_at", "user_id" ]
      all_valid_columns = (actual_columns + system_columns).uniq

      puts "\n📋 Foundation: #{foundation.name} (ID: #{foundation.id})"
      puts "   Actual columns: #{all_valid_columns.count}"

      # Get all views for this foundation
      views = FoundationView.where(foundation_id: foundation.id)

      views.each do |view|
        total_views += 1
        view_modified = false
        view_added = 0
        view_removed = 0

        next unless view.columns.is_a?(Hash)

        # Get current visible columns from view
        visible_map = view.columns["visible"] || {}
        order_array = view.columns["order"] || []

        # 1. Add any columns that exist in the table but not in the view
        all_valid_columns.each do |col_name|
          unless visible_map.key?(col_name)
            visible_map[col_name] = true  # New columns default to visible
            view_added += 1
            view_modified = true
          end

          unless order_array.include?(col_name)
            order_array << col_name
            view_modified = true
          end
        end

        # 2. Remove any columns that are in the view but no longer exist in the table
        columns_to_remove = visible_map.keys - all_valid_columns
        columns_to_remove.each do |col_name|
          visible_map.delete(col_name)
          view_removed += 1
          view_modified = true
        end

        # Also clean up order array
        order_to_remove = order_array - all_valid_columns
        if order_to_remove.any?
          order_array = order_array - order_to_remove
          view_modified = true
        end

        if view_modified
          view.columns["visible"] = visible_map
          view.columns["order"] = order_array.uniq  # Deduplicate just in case

          if view.save
            updated_views += 1
            added_columns += view_added
            removed_columns += view_removed
            puts "   ✅ View '#{view.name}': +#{view_added} added, -#{view_removed} removed"
          else
            puts "   ❌ View '#{view.name}': FAILED - #{view.errors.full_messages.join(', ')}"
          end
        else
          puts "   ⏭️  View '#{view.name}': already in sync"
        end
      end
    end

    puts "\n" + "=" * 60
    puts "Summary:"
    puts "  Total views processed: #{total_views}"
    puts "  Views updated: #{updated_views}"
    puts "  Columns added: #{added_columns}"
    puts "  Columns removed: #{removed_columns}"
    puts "=" * 60
  end
end
