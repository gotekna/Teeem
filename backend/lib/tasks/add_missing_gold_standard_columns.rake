namespace :gold_standard do
  desc "Add missing columns to Gold Standard Reference table (ID 166)"
  task add_missing_columns: :environment do
    puts "🔧 Adding missing columns to Gold Standard Reference table..."
    puts ""

    # Find the Gold Standard Reference table (ID 166)
    table = Table.find_by(name: 'Gold Standard Reference')
    unless table
      puts "❌ Gold Standard Reference table not found!"
      puts "   Searching for table by ID 166..."
      table = Table.find_by(id: 166)
    end

    unless table
      puts "❌ Could not find Gold Standard Reference table!"
      exit 1
    end

    puts "📊 Table: #{table.name} (ID: #{table.id})"
    puts "   Current columns: #{table.columns.count}"
    puts ""

    # Missing columns that need to be added (6 columns)
    missing_columns = [
      {
        name: 'Mobile',
        column_name: 'mobile',
        column_type: 'mobile',
        description: 'Mobile phone number',
        position: 5  # After Phone
      },
      {
        name: 'GPS Coordinates',
        column_name: 'location_coords',
        column_type: 'gps_coordinates',
        description: 'GPS coordinates for locations',
        position: 13  # After Date and Time
      },
      {
        name: 'Color Code',
        column_name: 'color_code',
        column_type: 'color_picker',
        description: 'Color picker for visual categorization',
        position: 14  # After GPS Coordinates
      },
      {
        name: 'File Attachment',
        column_name: 'file_attachment',
        column_type: 'file_upload',
        description: 'File upload reference',
        position: 15  # After Color Code
      },
      {
        name: 'Multiple Categories',
        column_name: 'multiple_category_ids',
        column_type: 'multiple_lookups',
        description: 'Link to multiple category records',
        position: 19  # After Lookup
      },
      {
        name: 'Updated At',
        column_name: 'updated_at',
        column_type: 'date_and_time',
        description: 'When the record was last modified',
        position: 22  # After Date and Time (Created)
      }
    ]

    added_count = 0
    skipped_count = 0

    missing_columns.each do |col_def|
      # Check if column already exists
      existing = table.columns.find_by(column_name: col_def[:column_name])

      if existing
        puts "  ⚠️  Column '#{col_def[:name]}' already exists (#{existing.column_type}) - skipping"
        skipped_count += 1
        next
      end

      # Create the column
      begin
        column = table.columns.create!(
          name: col_def[:name],
          column_name: col_def[:column_name],
          column_type: col_def[:column_type],
          description: col_def[:description]
        )

        puts "  ✅ Added: #{col_def[:name].ljust(25)} | Type: #{col_def[:column_type]}"
        added_count += 1
      rescue => e
        puts "  ❌ Error adding #{col_def[:name]}: #{e.message}"
      end
    end

    puts ""
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ Missing Columns Addition Complete!"
    puts "   Added:   #{added_count} columns"
    puts "   Skipped: #{skipped_count} (already exist)"
    puts "   Total columns now: #{table.reload.columns.count}"
    puts ""
    puts "   Expected: 21 columns (excluding select & id)"
    puts "   Target:   21 column types from COLUMN_TYPES"
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts ""
  end

  desc "Verify Gold Standard Reference table has all required columns"
  task verify: :environment do
    puts "🔍 Verifying Gold Standard Reference table columns..."
    puts ""

    table = Table.find_by(name: 'Gold Standard Reference') || Table.find_by(id: 166)

    unless table
      puts "❌ Gold Standard Reference table not found!"
      exit 1
    end

    puts "📊 Table: #{table.name} (ID: #{table.id})"
    puts ""

    # All required columns in order
    required_columns = [
      { name: 'Item Code', type: 'single_line_text' },
      { name: 'Email', type: 'email' },
      { name: 'Phone', type: 'phone' },
      { name: 'Mobile', type: 'mobile' },
      { name: 'Is Active', type: 'boolean' },
      { name: 'Discount Percentage', type: 'percentage' },
      { name: 'Price', type: 'currency' },
      { name: 'Quantity', type: 'number' },
      { name: 'Status', type: 'choice' },
      { name: 'Notes', type: 'multiple_lines_text' },
      { name: 'Date', type: 'date' },
      { name: 'Date and Time', type: 'date_and_time' },
      { name: 'GPS Coordinates', type: 'gps_coordinates' },
      { name: 'Color Code', type: 'color_picker' },
      { name: 'File Attachment', type: 'file_upload' },
      { name: 'Whole Number', type: 'whole_number' },
      { name: 'Lookup', type: 'lookup' },
      { name: 'Multiple Categories', type: 'multiple_lookups' },
      { name: 'User', type: 'user' },
      { name: 'URL', type: 'url' },
      { name: 'Updated At', type: 'date_and_time' }
    ]

    current_columns = table.columns.map { |c| { name: c.name, type: c.column_type } }

    puts "Current Columns (#{current_columns.count}):"
    current_columns.each_with_index do |col, idx|
      puts "  #{(idx + 1).to_s.rjust(2)}. #{col[:name].ljust(25)} | #{col[:type]}"
    end

    puts ""
    puts "Required Columns (#{required_columns.count}):"

    missing = []
    required_columns.each_with_index do |req, idx|
      found = current_columns.any? { |c| c[:name] == req[:name] && c[:type] == req[:type] }
      status = found ? "✓" : "✗"
      puts "  #{status} #{(idx + 1).to_s.rjust(2)}. #{req[:name].ljust(25)} | #{req[:type]}"
      missing << req unless found
    end

    if missing.any?
      puts ""
      puts "❌ Missing #{missing.count} columns:"
      missing.each do |col|
        puts "   - #{col[:name]} (#{col[:type]})"
      end
    else
      puts ""
      puts "✅ All required columns are present!"
    end

    puts ""
  end
end
