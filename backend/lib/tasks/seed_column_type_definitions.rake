# frozen_string_literal: true

namespace :teeem do
  namespace :gold_standard do
    desc 'Seed column_type_definitions table with all 30 column types'
    task seed_type_definitions: :environment do
      puts "🔄 Seeding column type definitions..."
      puts "=" * 80

      # All 21 column types with their properties
      # Matches Column::COLUMN_SQL_TYPE_MAP and Trinity T19.001-T19.021
      type_definitions = [
        {
          type_key: 'single_line_text',
          display_name: 'Single Line Text',
          sql_type: 'VARCHAR(255)',
          default_max_length: 255,
          validation_regex: nil,
          used_for: 'Short text input for names, titles, and brief descriptions'
        },
        {
          type_key: 'multiple_lines_text',
          display_name: 'Multiple Lines Text',
          sql_type: 'TEXT',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Long text for notes, descriptions, and multi-paragraph content'
        },
        {
          type_key: 'email',
          display_name: 'Email',
          sql_type: 'VARCHAR(255)',
          default_max_length: 255,
          validation_regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          used_for: 'Email address with format validation'
        },
        {
          type_key: 'phone',
          display_name: 'Phone',
          sql_type: 'VARCHAR(20)',
          default_max_length: 20,
          validation_regex: '^\+?[0-9\s\-\(\)]+$',
          used_for: 'Landline phone number'
        },
        {
          type_key: 'mobile',
          display_name: 'Mobile',
          sql_type: 'VARCHAR(20)',
          default_max_length: 20,
          validation_regex: '^\+?[0-9\s\-\(\)]+$',
          used_for: 'Mobile phone number'
        },
        {
          type_key: 'url',
          display_name: 'URL',
          sql_type: 'VARCHAR(500)',
          default_max_length: 500,
          validation_regex: '^https?://.+',
          used_for: 'Web address with http/https validation'
        },
        {
          type_key: 'number',
          display_name: 'Number',
          sql_type: 'NUMERIC(10,2)',
          default_max_length: nil,
          default_min_value: nil,
          default_max_value: nil,
          validation_regex: nil,
          used_for: 'Decimal number with 2 decimal places'
        },
        {
          type_key: 'whole_number',
          display_name: 'Whole Number',
          sql_type: 'INTEGER',
          default_max_length: nil,
          default_min_value: nil,
          default_max_value: nil,
          validation_regex: '^-?[0-9]+$',
          used_for: 'Integer without decimal places'
        },
        {
          type_key: 'currency',
          display_name: 'Currency',
          sql_type: 'NUMERIC(10,2)',
          default_max_length: nil,
          default_min_value: 0,
          default_max_value: nil,
          validation_regex: nil,
          used_for: 'Monetary value with 2 decimal places'
        },
        {
          type_key: 'percentage',
          display_name: 'Percentage',
          sql_type: 'NUMERIC(5,2)',
          default_max_length: nil,
          default_min_value: 0,
          default_max_value: 100,
          validation_regex: nil,
          used_for: 'Percentage value between 0-100'
        },
        {
          type_key: 'date',
          display_name: 'Date',
          sql_type: 'DATE',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Date without time component'
        },
        {
          type_key: 'date_and_time',
          display_name: 'Date and Time',
          sql_type: 'TIMESTAMP',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Date with time component'
        },
        {
          type_key: 'gps_coordinates',
          display_name: 'GPS Coordinates',
          sql_type: 'VARCHAR(100)',
          default_max_length: 100,
          validation_regex: '^-?[0-9]+\.?[0-9]*,\s*-?[0-9]+\.?[0-9]*$',
          used_for: 'Latitude,Longitude coordinates'
        },
        {
          type_key: 'color_picker',
          display_name: 'Color Picker',
          sql_type: 'VARCHAR(7)',
          default_max_length: 7,
          validation_regex: '^#[0-9A-Fa-f]{6}$',
          used_for: 'Hex color value (#RRGGBB)'
        },
        {
          type_key: 'file_upload',
          display_name: 'File Upload',
          sql_type: 'TEXT',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'File path or URL for uploaded files'
        },
        {
          type_key: 'action_buttons',
          display_name: 'Action Buttons',
          sql_type: 'VARCHAR(255)',
          default_max_length: 255,
          validation_regex: nil,
          used_for: 'Configurable action buttons'
        },
        {
          type_key: 'boolean',
          display_name: 'Checkbox',
          sql_type: 'BOOLEAN',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'True/false checkbox'
        },
        {
          type_key: 'choice',
          display_name: 'Choice',
          sql_type: 'VARCHAR(50)',
          default_max_length: 50,
          validation_regex: nil,
          used_for: 'Single selection from predefined options'
        },
        {
          type_key: 'lookup',
          display_name: 'Lookup',
          sql_type: 'VARCHAR(255)',
          default_max_length: 255,
          validation_regex: nil,
          used_for: 'Reference to another table (single value)',
          needs_config: true
        },
        {
          type_key: 'multiple_lookups',
          display_name: 'Multiple Lookups',
          sql_type: 'TEXT',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Reference to another table (multiple values)',
          needs_config: true
        },
        {
          type_key: 'user',
          display_name: 'User',
          sql_type: 'INTEGER',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Reference to a system user'
        },
        {
          type_key: 'computed',
          display_name: 'Computed',
          sql_type: 'VIRTUAL/COMPUTED',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Calculated field based on formula',
          needs_config: true
        },
        # Advanced Data Types (PostgreSQL-specific)
        {
          type_key: 'structured_data',
          display_name: 'Structured Data (JSON)',
          sql_type: 'JSONB',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Flexible JSON objects for config, metadata, nested data'
        },
        {
          type_key: 'array_of_items',
          display_name: 'Array of Items',
          sql_type: 'TEXT[]',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Multiple text values stored as an array (tags, IDs)'
        },
        {
          type_key: 'searchable_text',
          display_name: 'Full-Text Search',
          sql_type: 'TSVECTOR',
          default_max_length: nil,
          validation_regex: nil,
          used_for: 'Auto-generated search index (read-only)'
        },
        # Australian Standard Identifiers
        {
          type_key: 'abn',
          display_name: 'ABN',
          sql_type: 'VARCHAR(14)',
          default_max_length: 14,
          validation_regex: '^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$',
          used_for: 'Australian Business Number (11 digits, format: XX XXX XXX XXX)'
        },
        {
          type_key: 'acn',
          display_name: 'ACN',
          sql_type: 'VARCHAR(11)',
          default_max_length: 11,
          validation_regex: '^\d{3}\s?\d{3}\s?\d{3}$',
          used_for: 'Australian Company Number (9 digits, format: XXX XXX XXX)'
        },
        {
          type_key: 'bsb',
          display_name: 'BSB',
          sql_type: 'VARCHAR(7)',
          default_max_length: 7,
          validation_regex: '^\d{3}-?\d{3}$',
          used_for: 'Bank State Branch (6 digits, format: XXX-XXX)'
        },
        {
          type_key: 'bank_account',
          display_name: 'Bank Account',
          sql_type: 'VARCHAR(9)',
          default_max_length: 9,
          validation_regex: '^\d{1,9}$',
          used_for: 'Bank Account Number (up to 9 digits)'
        },
        {
          type_key: 'postcode',
          display_name: 'Postcode',
          sql_type: 'VARCHAR(4)',
          default_max_length: 4,
          validation_regex: '^\d{4}$',
          used_for: 'Australian Postcode (4 digits)'
        },
        {
          type_key: 'tfn',
          display_name: 'TFN',
          sql_type: 'VARCHAR(11)',
          default_max_length: 11,
          validation_regex: '^\d{3}\s?\d{3}\s?\d{3}$',
          used_for: 'Tax File Number (9 digits, format: XXX XXX XXX)'
        }
      ]

      created_count = 0
      updated_count = 0

      type_definitions.each do |defn|
        existing = ColumnTypeDefinition.find_by(type_key: defn[:type_key])

        if existing
          existing.update!(defn.merge(version: existing.version))
          puts "   ✅ Updated: #{defn[:type_key]}"
          updated_count += 1
        else
          ColumnTypeDefinition.create!(defn.merge(version: 1))
          puts "   ➕ Created: #{defn[:type_key]}"
          created_count += 1
        end
      end

      puts ""
      puts "=" * 80
      puts "✅ Column type definitions seeded!"
      puts "   Created: #{created_count}"
      puts "   Updated: #{updated_count}"
      puts "   Total: #{type_definitions.length}"
      puts ""
    end

    desc 'Link existing columns to their type definitions'
    task link_columns: :environment do
      puts "🔄 Linking columns to type definitions..."
      puts "=" * 80

      linked_count = 0
      skipped_count = 0

      # Get all columns without a type definition link (exclude system tables)
      columns = Column.joins(:foundation)
                      .where(column_type_definition_id: nil)
                      .where.not(foundations: { table_type: 'system' })

      columns.find_each do |column|
        type_def = ColumnTypeDefinition.find_by(type_key: column.column_type)

        if type_def
          column.update!(
            column_type_definition_id: type_def.id,
            type_version_applied: type_def.version
          )
          linked_count += 1
          puts "   ✅ Linked: #{column.foundation.name}.#{column.column_name} → #{type_def.type_key}"
        else
          skipped_count += 1
          puts "   ⚠️  No type definition for: #{column.column_type} (#{column.foundation.name}.#{column.column_name})"
        end
      end

      puts ""
      puts "=" * 80
      puts "✅ Column linking complete!"
      puts "   Linked: #{linked_count}"
      puts "   Skipped: #{skipped_count}"
      puts ""
    end

    desc 'Calculate compliance scores for all foundations'
    task calculate_compliance: :environment do
      puts "🔄 Calculating compliance scores..."
      puts "=" * 80

      results = GoldStandardComplianceService.recalculate_all!

      results.each do |result|
        status = result[:score] >= 100 ? '✅' : result[:score] >= 70 ? '⚠️' : '❌'
        puts "   #{status} #{result[:name]}: #{result[:score]}% (#{result[:compliant]}/#{result[:total]} columns)"
      end

      puts ""
      puts "=" * 80

      summary = GoldStandardComplianceService.system_summary
      puts "📊 System Summary:"
      puts "   Total foundations: #{summary[:total_foundations]}"
      puts "   Scored: #{summary[:scored_foundations]}"
      puts "   Average score: #{summary[:average_score]}%"
      puts "   Fully compliant: #{summary[:fully_compliant]}"
      puts "   Needs attention: #{summary[:needs_attention]}"
      puts ""
    end

    desc 'Run full Gold Standard setup (seed + link + calculate)'
    task setup: :environment do
      Rake::Task['teeem:gold_standard:seed_type_definitions'].invoke
      Rake::Task['teeem:gold_standard:link_columns'].invoke
      Rake::Task['teeem:gold_standard:calculate_compliance'].invoke
    end
  end
end
