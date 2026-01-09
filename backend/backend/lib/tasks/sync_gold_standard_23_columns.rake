namespace :gold_standard do
  desc "Sync Gold Standard Reference table to match 23-column specification"
  task sync_23_columns: :environment do
    puts "🔄 Syncing Gold Standard Reference table to 23-column specification..."
    puts ""

    # Find the Gold Standard Reference table (ID 166)
    table = Table.find_by(name: 'Gold Standard Reference') || Table.find_by(id: 166)

    unless table
      puts "❌ Gold Standard Reference table not found!"
      exit 1
    end

    puts "📊 Table: #{table.name} (ID: #{table.id})"
    puts "   Current columns: #{table.columns.count}"
    puts ""

    # The 23 columns from the CSV specification
    # Format: [display_name, column_type, db_column_name]
    column_specs = [
      # 1. ID is automatic, skip it
      [ 'Single line text', 'single_line_text', 'item_code' ],
      [ 'Long text', 'multiple_lines_text', 'notes' ],
      [ 'Email', 'email', 'email' ],
      [ 'Phone number', 'phone', 'phone' ],
      [ 'Mobile', 'mobile', 'mobile' ],
      [ 'URL', 'url', 'document_link' ],
      [ 'Number', 'number', 'quantity' ],
      [ 'Whole number', 'whole_number', 'whole_number' ],
      [ 'Currency', 'currency', 'price' ],
      [ 'Percent', 'percentage', 'discount' ],
      [ 'Date', 'date', 'start_date' ],
      [ 'Date & Time (Created)', 'date_and_time', 'created_at' ],
      [ 'GPS Coordinates', 'gps_coordinates', 'location_coords' ],
      [ 'Color Picker', 'color_picker', 'color_code' ],
      [ 'File Upload', 'file_upload', 'file_attachment' ],
      [ 'Checkbox', 'boolean', 'is_active' ],
      [ 'Choice', 'choice', 'status' ],
      [ 'Link to another record', 'lookup', 'category_type' ],
      [ 'Link to multiple records', 'multiple_lookups', 'multiple_category_ids' ],
      [ 'User', 'user', 'user_id' ],
      [ 'Formula', 'computed', 'total_cost' ],
      [ 'Date & Time (Updated)', 'date_and_time', 'updated_at' ]
    ]

    puts "Target: #{column_specs.count} columns (excluding id)"
    puts ""

    added_count = 0
    updated_count = 0
    skipped_count = 0

    column_specs.each_with_index do |spec, index|
      display_name, column_type, db_column_name = spec

      # Check if column already exists by name
      existing = table.columns.find_by(name: display_name)

      if existing
        # Check if type needs updating
        if existing.column_type != column_type
          puts "  🔄 Update:  #{display_name.ljust(30)} | #{existing.column_type} → #{column_type}"
          existing.update!(column_type: column_type)
          updated_count += 1
        else
          puts "  ✓  Correct: #{display_name.ljust(30)} | #{column_type}"
          skipped_count += 1
        end
      else
        # Create new column
        begin
          column = table.columns.create!(
            name: display_name,
            column_name: db_column_name,
            column_type: column_type
          )
          puts "  ✅ Added:   #{display_name.ljust(30)} | #{column_type}"
          added_count += 1
        rescue => e
          puts "  ❌ Error adding #{display_name}: #{e.message}"
        end
      end
    end

    # Reload to get final count
    final_count = table.reload.columns.count

    puts ""
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ Gold Standard Sync Complete!"
    puts ""
    puts "   Added:   #{added_count} columns"
    puts "   Updated: #{updated_count} columns"
    puts "   Skipped: #{skipped_count} columns (already correct)"
    puts ""
    puts "   Total columns: #{final_count}"
    puts "   Expected:      #{column_specs.count + 1} (22 data columns + id)"
    puts ""

    if final_count == column_specs.count + 1
      puts "   ✅ PERFECT! Table matches 23-column specification exactly!"
    else
      puts "   ⚠️  Column count mismatch - review needed"
    end
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts ""
  end

  desc "Show current Gold Standard Reference table column status"
  task show_columns: :environment do
    table = Table.find_by(name: 'Gold Standard Reference') || Table.find_by(id: 166)

    unless table
      puts "❌ Gold Standard Reference table not found!"
      exit 1
    end

    puts ""
    puts "📊 Gold Standard Reference Table (ID: #{table.id})"
    puts "   Total columns: #{table.columns.count}"
    puts ""
    puts "   Columns:"

    table.columns.order(:id).each_with_index do |col, idx|
      puts "   #{(idx + 1).to_s.rjust(2)}. #{col.name.ljust(35)} | #{col.column_type.ljust(25)} | #{col.column_name}"
    end
    puts ""
  end
end
