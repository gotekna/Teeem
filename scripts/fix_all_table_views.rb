#!/usr/bin/env ruby
# Script to update ALL table views to show ALL columns for tables with hidden columns

require_relative '../config/environment'

# Find tables with hidden columns (position > 40)
tables_with_hidden = Table.all.select do |t|
  hidden_count = t.columns.where('position > 40').count
  hidden_count > 0
end

puts "Found #{tables_with_hidden.length} tables with hidden columns:"
tables_with_hidden.each do |t|
  total = t.columns.count
  hidden = t.columns.where('position > 40').count
  puts "  - #{t.name} (ID: #{t.id}): #{total} total, #{hidden} hidden"
end
puts

# Process each table
tables_with_hidden.each do |table|
  puts "="*60
  puts "Processing: #{table.name} (ID: #{table.id})"
  puts "="*60

  # Get all column names
  all_column_names = table.columns.order(:position).pluck(:column_name)
  puts "Total columns: #{all_column_names.length}"

  # Find all views for this table
  views = TableView.where(table_id: table.id)
  puts "Views to update: #{views.count}"

  views.each do |view|
    current_visible = view.columns['visible'] || {}
    current_visible_count = current_visible.count { |k, v| v == true }

    puts "\n  View: #{view.name} (ID: #{view.id})"
    puts "    User: #{view.user&.name || 'N/A'}"
    puts "    Current visible: #{current_visible_count}"

    # Build new visible hash with ALL columns set to true
    new_visible = {}
    all_column_names.each { |col_name| new_visible[col_name] = true }
    new_visible['id'] = true  # System ID column

    # Build new order array
    current_order = view.columns['order'] || []
    new_order = [ 'select', 'id' ] + all_column_names + [ 'actions' ]

    # Update the view
    view.update(
      columns: {
        visible: new_visible,
        order: new_order
      }
    )

    puts "    ✓ Updated to show #{new_visible.count { |k, v| v }} columns"
  end

  puts
end

puts "="*60
puts "Summary: Updated views for #{tables_with_hidden.length} tables"
puts "="*60
