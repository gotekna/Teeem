#!/usr/bin/env ruby
# frozen_string_literal: true

puts "\n🔧 Setting up Setup views on PRODUCTION...\n\n"

tables = Table.where.not("name LIKE ?", "Import%").where.not(name: [ "Table Views", "columns" ]).order(:name)
puts "Processing #{tables.count} tables...\n\n"

created_count = 0
updated_count = 0
skipped_count = 0

tables.each do |table|
  existing_setup = TableView.find_by(table_id: table.id, name: "Setup")

  if existing_setup
    puts "⏭️  #{table.name} - Setup view already exists"
    skipped_count += 1
    next
  end

  default_view = TableView.find_by(table_id: table.id, name: "Default")

  if default_view
    all_columns = table.columns.pluck(:column_name)
    # Note: 'select' and 'actions' are UI-only pseudo-columns, not database columns
    visible_columns = { "id" => true }
    all_columns.each { |col| visible_columns[col] = true }
    column_order = [ "select", "id", "actions" ] + all_columns

    # Use update_columns to skip validations (view already exists)
    default_view.update_columns(
      name: "Setup",
      display_order: 0,
      columns: { "visible" => visible_columns, "order" => column_order },
      filters: []
    )

    puts "✅ #{table.name} - Renamed Default to Setup"
    updated_count += 1
  else
    begin
      all_columns = table.columns.pluck(:column_name)
      # Note: 'select' and 'actions' are UI-only pseudo-columns, not database columns
      visible_columns = { "id" => true }
      all_columns.each { |col| visible_columns[col] = true }
      column_order = [ "select", "id", "actions" ] + all_columns

      TableView.create!(
        table_id: table.id,
        user_id: 1,
        name: "Setup",
        display_order: 0,
        columns: { "visible" => visible_columns, "order" => column_order },
        filters: []
      )

      puts "✅ #{table.name} - Created Setup view"
      created_count += 1
    rescue => e
      puts "❌ #{table.name} - FAILED: #{e.message}"
    end
  end
end

puts "\n" + "="*60
puts "Created: #{created_count}, Updated: #{updated_count}, Skipped: #{skipped_count}"
puts "✅ Setup views are ready!"
puts ""
