namespace :gold_standard do
  desc "Fix column types in Gold Standard Reference table to match their actual types"
  task fix_types: :environment do
    puts "🔧 Fixing Gold Standard Reference table column types..."
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

    # Map of column names to their correct types
    column_type_fixes = {
      'item_code' => 'single_line_text',
      'email' => 'email',
      'phone' => 'phone',
      'mobile' => 'mobile',
      'document_link' => 'url',
      'notes' => 'multiple_lines_text',
      'start_date' => 'date',
      'created_at' => 'date_and_time',
      'location_coords' => 'gps_coordinates',
      'color_code' => 'color_picker',
      'file_attachment' => 'file_upload',
      'is_active' => 'boolean',
      'status' => 'choice',
      'discount' => 'percentage',
      'price' => 'currency',
      'quantity' => 'number',
      'whole_number' => 'whole_number',
      'category_type' => 'lookup',
      'multiple_category_ids' => 'multiple_lookups',
      'user_id' => 'user',
      'total_cost' => 'computed',
      'updated_at' => 'date_and_time',
      'last_modified_at' => 'date_and_time'
    }

    fixed_count = 0
    skipped_count = 0
    error_count = 0

    column_type_fixes.each do |column_name, correct_type|
      column = table.columns.find_by(column_name: column_name)

      unless column
        puts "  ⚠️  Column not found: #{column_name}"
        next
      end

      if column.column_type == correct_type
        puts "  ✓  #{column.name.ljust(30)} | Already correct: #{correct_type}"
        skipped_count += 1
      else
        begin
          old_type = column.column_type
          column.update!(column_type: correct_type)
          puts "  ✅ #{column.name.ljust(30)} | #{old_type} → #{correct_type}"
          fixed_count += 1
        rescue => e
          puts "  ❌ #{column.name.ljust(30)} | Error: #{e.message}"
          error_count += 1
        end
      end
    end

    puts ""
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ Gold Standard Column Type Fix Complete!"
    puts "   Fixed:   #{fixed_count} columns"
    puts "   Skipped: #{skipped_count} columns (already correct)"
    puts "   Errors:  #{error_count} columns"
    puts ""
    puts "   Total columns: #{table.reload.columns.count}"
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts ""
  end
end
