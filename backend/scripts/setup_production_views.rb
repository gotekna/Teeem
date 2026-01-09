#!/usr/bin/env ruby
# frozen_string_literal: true

# Script to create Setup views for all tables on production
# Excludes Import tables and system tables

puts "\n🔧 Setting up Setup views on PRODUCTION...\n\n"

# Get all tables except Import tables and system tables
tables = Table.where.not("name LIKE ?", "Import%")
             .where.not(name: [ "Table Views", "columns" ])
             .order(:name)

puts "Processing #{tables.count} tables...\n\n"

created_count = 0
updated_count = 0
skipped_count = 0

tables.each do |table|
  # Check if Setup view already exists
  existing_setup = TableView.find_by(table_id: table.id, name: "Setup")

  if existing_setup
    puts "⏭️  #{table.name} - Setup view already exists (ID: #{existing_setup.id})"
    skipped_count += 1
    next
  end

  # Check if there's a "Default" view we should rename
  default_view = TableView.find_by(table_id: table.id, name: "Default")

  if default_view
    # Rename Default to Setup and update settings
    all_columns = table.columns.pluck(:column_name)

    # Note: 'select' and 'actions' are UI-only pseudo-columns, not database columns
    visible_columns = {
      'id' => true
    }

    all_columns.each do |col|
      visible_columns[col] = true
    end

    column_order = [ 'select', 'id', 'actions' ] + all_columns

    default_view.update!(
      name: 'Setup',
      display_order: 0,
      columns: {
        'visible' => visible_columns,
        'order' => column_order
      },
      filters: [],
      filter_groups: [ { 'id' => 'default', 'logic' => 'AND' } ],
      inter_group_logic: 'OR'
    )

    puts "✅ #{table.name} - Renamed 'Default' to 'Setup' (ID: #{default_view.id})"
    updated_count += 1
  else
    # Create new Setup view
    begin
      all_columns = table.columns.pluck(:column_name)

      # Note: 'select' and 'actions' are UI-only pseudo-columns, not database columns
      visible_columns = {
        'id' => true
      }

      all_columns.each do |col|
        visible_columns[col] = true
      end

      column_order = [ 'select', 'id', 'actions' ] + all_columns

      setup_view = TableView.create!(
        table_id: table.id,
        user_id: 1, # System user
        name: 'Setup',
        display_order: 0,
        columns: {
          'visible' => visible_columns,
          'order' => column_order
        },
        filters: [],
        filter_groups: [ { 'id' => 'default', 'logic' => 'AND' } ],
        inter_group_logic: 'OR',
        sort_columns: []
      )

      puts "✅ #{table.name} - Created Setup view (ID: #{setup_view.id})"
      created_count += 1
    rescue => e
      puts "❌ #{table.name} - FAILED: #{e.message}"
    end
  end
end

puts "\n" + "="*60
puts "📊 Summary:"
puts "="*60
puts "Created: #{created_count}"
puts "Updated (renamed Default): #{updated_count}"
puts "Skipped (already exists): #{skipped_count}"
puts "Total tables processed: #{tables.count}"
puts "\n✅ Setup views are ready on production!"
puts ""
