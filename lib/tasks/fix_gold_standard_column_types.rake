namespace :gold_standard do
  desc "Fix Gold Standard table column types to match column names"
  task fix_column_types: :environment do
    puts "🔧 Fixing Gold Standard table column types..."
    puts ""

    # Find the Gold Standard Reference table (ID 166)
    table = Table.find_by(id: 166) || Table.find_by(name: 'Gold Standard Reference')
    unless table
      puts "❌ Gold Standard Reference table not found!"
      exit 1
    end

    puts "📊 Table: #{table.name} (ID: #{table.id})"
    puts ""

    # Map column names to their correct types
    column_name_to_type = {
      'item_code' => 'single_line_text',
      'email' => 'email',
      'phone' => 'phone',
      'mobile' => 'mobile',
      'document_link' => 'url',
      'start_date' => 'date',
      'location_coords' => 'gps_coordinates',
      'color_code' => 'color_picker',
      'file_attachment' => 'file_upload',
      'category_type' => 'lookup',
      'is_active' => 'boolean',
      'discount' => 'percentage',
      'status' => 'choice',
      'price' => 'currency',
      'quantity' => 'number',
      'whole_number' => 'whole_number',
      'total_cost' => 'computed',
      'notes' => 'multiple_lines_text',
      'multiple_category_ids' => 'multiple_lookups',
      'user_id' => 'user'
    }

    updated_count = 0
    skipped_count = 0

    column_name_to_type.each do |col_name, correct_type|
      column = table.columns.find_by(column_name: col_name)
      
      unless column
        puts "  ⚠️  Column '#{col_name}' not found - skipping"
        skipped_count += 1
        next
      end

      current_type = column.column_type
      
      if current_type == correct_type
        puts "  ✓  #{col_name.ljust(25)} | Already correct: #{correct_type}"
        skipped_count += 1
      else
        puts "  🔄 #{col_name.ljust(25)} | Updating: #{current_type.ljust(20)} → #{correct_type}"
        
        column.update!(column_type: correct_type)
        updated_count += 1
      end
    end

    puts ""
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ Column Type Fix Complete!"
    puts "   Updated: #{updated_count} columns"
    puts "   Skipped: #{skipped_count} (already correct or not found)"
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts ""
  end
end
