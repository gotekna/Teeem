require 'csv'

namespace :gold_standard do
  desc "Sync Gold Standard Reference table columns from CSV specification"
  task sync_from_csv: :environment do
    puts "🔄 Syncing Gold Standard Reference table from CSV specification..."
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

    # CSV path - adjust if needed
    csv_path = Rails.root.join('..', 'Downloads', 'gold_standard_columns (2).csv')

    unless File.exist?(csv_path)
      puts "❌ CSV file not found at: #{csv_path}"
      puts "   Please provide the path to the CSV file."
      exit 1
    end

    puts "📄 Reading CSV: #{csv_path}"
    puts ""

    # Read CSV and parse column definitions
    csv_columns = []
    CSV.foreach(csv_path, headers: true) do |row|
      # Skip the 'id' row as it's automatically handled
      next if row['Column Name (Database)'] == 'id'

      # Map CSV column type names to our internal column types
      db_column_name = row['Column Name (Database)']

      # Special handling for timestamp columns
      column_type = case db_column_name
      when 'created_at', 'updated_at'
        'date_and_time'
      when 'checkbox'
        'boolean'
      when 'choice'
        'choice'
      else
        db_column_name
      end

      csv_columns << {
        column_name: db_column_name,
        name: row['Display Name'],
        column_type: column_type,
        sql_type: row['SQL Type'],
        validation: row['Validation Rules'],
        example: row['Example'],
        used_for: row['Used For']
      }
    end

    puts "CSV contains #{csv_columns.count} column definitions (excluding id)"
    puts ""

    # Map to actual database column names used in gold_standard_items
    column_name_mapping = {
      'single_line_text' => 'item_code',
      'multiple_lines_text' => 'notes',
      'email' => 'email',
      'phone' => 'phone',
      'mobile' => 'mobile',
      'url' => 'document_link',
      'number' => 'quantity',
      'whole_number' => 'whole_number',
      'currency' => 'price',
      'percentage' => 'discount',
      'date' => 'start_date',
      'created_at' => 'created_at',
      'gps_coordinates' => 'location_coords',
      'color_picker' => 'color_code',
      'file_upload' => 'file_attachment',
      'checkbox' => 'is_active',
      'choice' => 'status',
      'lookup' => 'category_type',
      'multiple_lookups' => 'multiple_category_ids',
      'user' => 'user_id',
      'computed' => 'total_cost',
      'updated_at' => 'updated_at'
    }

    added_count = 0
    updated_count = 0
    skipped_count = 0

    csv_columns.each_with_index do |col_def, index|
      # Get the actual database column name
      db_col_name = column_name_mapping[col_def[:column_name]] || col_def[:column_name]

      # Check if column already exists
      existing = table.columns.find_by(name: col_def[:name])

      if existing
        # Update if needed
        if existing.column_type != col_def[:column_type]
          puts "  🔄 Updating: #{col_def[:name].ljust(30)} | #{existing.column_type} → #{col_def[:column_type]}"
          existing.update!(column_type: col_def[:column_type])
          updated_count += 1
        else
          puts "  ✓  Exists:   #{col_def[:name].ljust(30)} | #{col_def[:column_type]}"
          skipped_count += 1
        end
      else
        # Create new column
        begin
          column = table.columns.create!(
            name: col_def[:name],
            column_name: db_col_name,
            column_type: col_def[:column_type]
          )
          puts "  ✅ Added:    #{col_def[:name].ljust(30)} | #{col_def[:column_type]}"
          added_count += 1
        rescue => e
          puts "  ❌ Error adding #{col_def[:name]}: #{e.message}"
        end
      end
    end

    puts ""
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ Gold Standard Sync Complete!"
    puts "   Added:   #{added_count} columns"
    puts "   Updated: #{updated_count} columns"
    puts "   Skipped: #{skipped_count} columns (already correct)"
    puts ""
    puts "   Total columns now: #{table.reload.columns.count}"
    puts "   Expected from CSV: #{csv_columns.count} (+ id = #{csv_columns.count + 1} total)"
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts ""
  end
end
