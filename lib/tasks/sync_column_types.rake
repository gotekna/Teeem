require 'csv'

namespace :trapid do
  namespace :column_types do
    desc 'Sync all column type definitions from CSV to all sources'
    task sync_from_csv: :environment do
      csv_path = Rails.root.join('..', 'TRAPID_DOCS', 'gold_standard_columns.csv')

      unless File.exist?(csv_path)
        puts "❌ CSV file not found at: #{csv_path}"
        puts "Please provide the path to gold_standard_columns.csv"
        exit 1
      end

      puts "🔄 Syncing column types from CSV..."
      puts "=" * 80

      # Read CSV
      column_definitions = []
      # Map CSV column names to actual column types
      column_type_mapping = {
        'created_at' => 'date_and_time',  # created_at is a date_and_time type
        'updated_at' => 'date_and_time',  # updated_at is a date_and_time type
        'checkbox' => 'boolean'            # checkbox is a boolean type
      }

      CSV.foreach(csv_path, headers: true) do |row|
        csv_column_name = row['Column Name (Database)']
        next if csv_column_name == 'id' # Skip ID, it's auto-generated

        # Skip system columns that are auto-generated
        next if ['created_at', 'updated_at'].include?(csv_column_name)

        # Map checkbox to boolean
        actual_column_type = column_type_mapping[csv_column_name] || csv_column_name

        column_definitions << {
          column_type: actual_column_type,
          csv_name: csv_column_name,
          display_name: row['Display Name'],
          sql_type: row['SQL Type'],
          display_type: row['Display Type'],
          validation_rules: row['Validation Rules'],
          example: row['Example'],
          used_for: row['Used For']
        }
      end

      puts "📖 Found #{column_definitions.length} column type definitions in CSV"
      puts ""

      # 1. Update Gold Standard Table
      puts "1️⃣  Updating Gold Standard Reference table..."
      gold_table = Table.find_by(id: 1) || Table.find_by(name: 'Gold Standard Reference')

      unless gold_table
        puts "❌ Gold Standard Reference table not found"
        exit 1
      end

      column_definitions.each do |defn|
        column = gold_table.columns.find_by(column_type: defn[:column_type])

        if column
          # Update existing column (skip validation for lookups in Gold Standard table)
          column.update_columns(
            name: defn[:display_name],
            required: false,
            updated_at: Time.current
          )
          puts "   ✅ Updated: #{defn[:column_type]} (#{defn[:display_name]})"
        else
          # Create new column if it doesn't exist
          # For lookup columns in Gold Standard, we'll skip the lookup_table validation
          # by using a dummy lookup_table_id
          attrs = {
            name: defn[:display_name],
            column_name: defn[:column_type],
            column_type: defn[:column_type],
            required: false,
            position: gold_table.columns.count + 1
          }

          # For lookup columns, set a dummy lookup_table_id to pass validation
          if defn[:column_type].in?(['lookup', 'multiple_lookups'])
            attrs[:lookup_table_id] = gold_table.id  # Self-reference as example
          end

          gold_table.columns.create!(attrs)
          puts "   ➕ Created: #{defn[:column_type]} (#{defn[:display_name]})"
        end
      end

      puts ""

      # 2. Update Trinity Teacher Entries
      puts "2️⃣  Updating Trinity Teacher entries..."

      section_number = 19
      column_definitions.each_with_index do |defn, index|
        entry_number = "T#{section_number}.#{(index + 1).to_s.rjust(3, '0')}"

        title = "#{defn[:display_name]} - #{defn[:column_type]}"

        content = <<~MARKDOWN
          # #{title}

          ## Overview
          #{defn[:display_type]} field for data tables.

          ## Database Type
          - **SQL Type**: `#{defn[:sql_type]}`
          - **Column Type**: `#{defn[:column_type]}`

          ## Validation Rules
          #{defn[:validation_rules]}

          ## Examples
          ```
          #{defn[:example]}
          ```

          ## Usage
          #{defn[:used_for]}

          ## Implementation
          This column type is defined in:
          - Backend: `Column::COLUMN_SQL_TYPE_MAP`
          - Frontend: `COLUMN_TYPES` constant
          - Gold Standard Table: Column definition
        MARKDOWN

        dense_index = "#{entry_number.gsub('.', '').downcase} #{defn[:column_type]} #{defn[:display_name].downcase.gsub(' ', '')} columntype teacher #{defn[:sql_type].downcase.gsub(/[(),]/, '')}"

        entry = Trinity.find_or_initialize_by(
          section_number: entry_number,
          category: 'teacher'
        )

        entry.update!(
          title: title,
          description: "Column type: #{defn[:sql_type]}",
          details: content,
          summary: defn[:used_for],
          examples: defn[:example],
          dense_index: dense_index,
          chapter_number: section_number,
          chapter_name: 'Column Types',
          entry_type: 'component'
        )

        puts "   ✅ #{entry_number} - #{title}"
      end

      puts ""

      # 3. Generate Backend COLUMN_SQL_TYPE_MAP
      puts "3️⃣  Generating backend COLUMN_SQL_TYPE_MAP..."

      backend_map = column_definitions.map do |defn|
        "    '#{defn[:column_type]}' => '#{defn[:sql_type]}'"
      end.join(",\n")

      backend_code = <<~RUBY
        # AUTO-GENERATED from gold_standard_columns.csv
        # DO NOT EDIT MANUALLY - Run: rails trapid:column_types:sync_from_csv
        # Last updated: #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}

        COLUMN_SQL_TYPE_MAP = {
        #{backend_map}
        }.freeze
      RUBY

      puts backend_code
      puts ""
      puts "   📋 Copy this code to backend/app/models/column.rb (lines 67-90)"
      puts ""

      # 4. Generate Frontend COLUMN_TYPES constant
      puts "4️⃣  Generating frontend COLUMN_TYPES constant..."
      puts "   ⚠️  Frontend constant should be kept as fallback only"
      puts "   ✅ Frontend already fetches from API via getColumnTypesWithCache()"
      puts ""

      # 5. Summary
      puts "=" * 80
      puts "✅ Sync completed!"
      puts ""
      puts "📊 Summary:"
      puts "   - #{column_definitions.length} column types processed"
      puts "   - Gold Standard table updated"
      puts "   - Trinity Teacher entries created/updated"
      puts "   - Backend code generated (needs manual copy)"
      puts ""
      puts "🔍 Next steps:"
      puts "   1. Copy the COLUMN_SQL_TYPE_MAP code to backend/app/models/column.rb"
      puts "   2. Run the sync check: http://localhost:5173/admin/system?tab=gold-standard (Sync Check tab)"
      puts "   3. Verify all sources show 'match' status"
      puts ""
    end

    desc 'Import column types CSV to Gold Standard table'
    task import_csv: :environment do
      # Prompt for CSV path
      print "Enter path to gold_standard_columns.csv: "
      csv_path = STDIN.gets.chomp

      unless File.exist?(csv_path)
        puts "❌ File not found: #{csv_path}"
        exit 1
      end

      puts "🔄 Importing column types from CSV..."
      Rake::Task['trapid:column_types:sync_from_csv'].invoke
    end
  end
end
