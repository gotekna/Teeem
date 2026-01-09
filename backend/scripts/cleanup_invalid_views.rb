#!/usr/bin/env ruby
# frozen_string_literal: true

# Script to clean up TableViews with invalid column references
# Usage:
#   rails runner scripts/cleanup_invalid_views.rb          # Interactive mode
#   rails runner scripts/cleanup_invalid_views.rb --yes    # Auto-confirm deletion

auto_confirm = ARGV.include?('--yes')

puts "\n🔍 Analyzing saved views for invalid column references...\n\n"

# Track statistics
stats = {
  total_views: 0,
  invalid_views: 0,
  deleted_views: [],
  tables_affected: Set.new
}

# Get all table views
TableView.includes(:table, :user).find_each do |view|
  stats[:total_views] += 1

  next unless view.table_id && view.table

  # Get valid column keys for this table
  valid_column_keys = view.table.columns.pluck(:column_name).to_set

  # Add standard columns that are always valid
  valid_column_keys.add('select')
  valid_column_keys.add('actions')

  # Check if view has columns configuration
  next unless view.columns.is_a?(Hash)

  # Get column keys from the view
  view_column_keys = Set.new

  # Check 'visible' hash
  if view.columns['visible'].is_a?(Hash)
    view_column_keys.merge(view.columns['visible'].keys)
  end

  # Check 'order' array
  if view.columns['order'].is_a?(Array)
    view_column_keys.merge(view.columns['order'])
  end

  # Find invalid columns (columns in view but not in table)
  invalid_columns = view_column_keys - valid_column_keys

  if invalid_columns.any?
    stats[:invalid_views] += 1
    stats[:tables_affected].add(view.table.name)

    puts "❌ Invalid view found:"
    puts "   View ID: #{view.id}"
    puts "   View Name: #{view.name}"
    puts "   Table: #{view.table.name} (ID: #{view.table_id})"
    puts "   User: #{view.user.email} (ID: #{view.user_id})"
    puts "   Invalid Columns: #{invalid_columns.to_a.join(', ')}"
    puts "   Valid Columns Count: #{valid_column_keys.size}"
    puts "   View Columns Count: #{view_column_keys.size}"
    puts ""

    stats[:deleted_views] << {
      id: view.id,
      name: view.name,
      table: view.table.name,
      table_id: view.table_id,
      user_id: view.user_id,
      invalid_columns: invalid_columns.to_a
    }
  end
end

puts "\n📊 Summary:"
puts "   Total views analyzed: #{stats[:total_views]}"
puts "   Invalid views found: #{stats[:invalid_views]}"
puts "   Tables affected: #{stats[:tables_affected].size}"
puts ""

if stats[:invalid_views] > 0
  puts "🗑️  The following views will be deleted:\n\n"
  stats[:deleted_views].each_with_index do |view, idx|
    puts "   #{idx + 1}. #{view[:name]} (ID: #{view[:id]}) - Table: #{view[:table]} - Invalid: #{view[:invalid_columns].join(', ')}"
  end
  puts ""

  if auto_confirm
    response = 'yes'
    puts "✅ Auto-confirming deletion (--yes flag provided)"
  else
    print "❓ Proceed with deletion? (yes/no): "
    response = STDIN.gets&.chomp&.downcase || 'no'
  end

  if response == 'yes'
    puts "\n🧹 Deleting invalid views...\n"

    deleted_count = 0
    stats[:deleted_views].each do |view_info|
      view = TableView.find_by(id: view_info[:id])
      if view
        view.destroy
        deleted_count += 1
        puts "   ✅ Deleted: #{view_info[:name]} (ID: #{view_info[:id]})"
      end
    end

    puts "\n✅ Deleted #{deleted_count} invalid views"

    # Now resequence display_order for all affected tables
    puts "\n🔢 Resequencing display_order for affected tables...\n"

    affected_combos = Set.new
    stats[:deleted_views].each do |view_info|
      affected_combos.add([ view_info[:table_id], view_info[:user_id] ])
    end

    affected_combos.each do |(table_id, user_id)|
      views = TableView.where(table_id: table_id, user_id: user_id)
                       .order(:display_order, :created_at)

      views.each_with_index do |view, index|
        if view.display_order != index
          view.update_column(:display_order, index)
          puts "   📝 Updated #{view.name} (ID: #{view.id}) - display_order: #{index}"
        end
      end

      table_name = Table.find_by(id: table_id)&.name || "Table #{table_id}"
      user_email = User.find_by(id: user_id)&.email || "User #{user_id}"
      puts "   ✅ Resequenced views for #{table_name} / #{user_email}"
    end

    puts "\n🎉 Cleanup complete!"
  else
    puts "\n❌ Cleanup cancelled."
  end
else
  puts "✅ No invalid views found. All views are clean!"
end

puts ""
