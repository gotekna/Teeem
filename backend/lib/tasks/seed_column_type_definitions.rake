# frozen_string_literal: true

namespace :teeem do
  namespace :gold_standard do
    desc "Seed column_type_definitions table with all 34 column types"
    task seed_type_definitions: :environment do
      puts "🔄 Seeding column type definitions..."
      puts "=" * 80

      # All 34 column types with their properties (SSoT: Column::COLUMN_SQL_TYPE_MAP)
      # Matches Column::COLUMN_SQL_TYPE_MAP and Trinity T19.001-T19.021
      # Now includes display_formatter for frontend rendering
      type_definitions = [
        # ============================================
        # TEXT TYPES
        # ============================================
        {
          type_key: "single_line_text",
          display_name: "Single Line Text",
          category: "Text",
          sql_type: "VARCHAR(255)",
          default_max_length: 255,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "text",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "FileText",
          example_values: "Hello World",
          used_for: "Short text input for names, titles, and brief descriptions"
        },
        {
          type_key: "multiple_lines_text",
          display_name: "Long Text",
          category: "Text",
          sql_type: "TEXT",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "multiline",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "AlignLeft",
          example_values: "Multi-line\ntext content",
          used_for: "Long text for notes, descriptions, and multi-paragraph content"
        },
        {
          type_key: "email",
          display_name: "Email",
          category: "Text",
          sql_type: "VARCHAR(255)",
          default_max_length: 255,
          validation_regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          validation_message: "Must be a valid email address",
          display_formatter: "text",
          display_format: nil,
          link_template: "mailto:{value}",
          input_mask: nil,
          icon: "Mail",
          example_values: "user@example.com",
          used_for: "Email address with format validation"
        },
        {
          type_key: "phone",
          display_name: "Phone",
          category: "Text",
          sql_type: "VARCHAR(20)",
          default_max_length: 20,
          validation_regex: '^\+?[0-9\s\-\(\)]+$',
          validation_message: "Must be a valid phone number",
          display_formatter: "phone",
          display_format: "(XX) XXXX XXXX",
          link_template: "tel:{value}",
          input_mask: nil,
          icon: "Phone",
          example_values: "(03) 9123 4567",
          used_for: "Landline phone number"
        },
        {
          type_key: "mobile",
          display_name: "Mobile",
          category: "Text",
          sql_type: "VARCHAR(20)",
          default_max_length: 20,
          validation_regex: '^04\d{8}$',
          validation_message: "Must be a valid Australian mobile (04XX XXX XXX)",
          display_formatter: "phone",
          display_format: "XXXX XXX XXX",
          link_template: "tel:{value}",
          input_mask: nil,
          icon: "Smartphone",
          example_values: "0412 345 678",
          used_for: "Mobile phone number"
        },
        {
          type_key: "url",
          display_name: "URL",
          category: "Text",
          sql_type: "VARCHAR(500)",
          default_max_length: 500,
          validation_regex: "^https?://.+",
          validation_message: "Must be a valid URL (http:// or https://)",
          display_formatter: "url",
          display_format: nil,
          link_template: "{value}",
          input_mask: nil,
          icon: "Link",
          example_values: "https://example.com",
          used_for: "Web address with http/https validation"
        },
        # ============================================
        # NUMBER TYPES
        # ============================================
        {
          type_key: "number",
          display_name: "Number",
          category: "Numbers",
          sql_type: "NUMERIC(10,2)",
          default_max_length: nil,
          default_min_value: nil,
          default_max_value: nil,
          validation_regex: nil,
          validation_message: "Must be a valid number",
          display_formatter: "number",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Hash",
          example_values: "123.45",
          used_for: "Decimal number with 2 decimal places"
        },
        {
          type_key: "whole_number",
          display_name: "Whole Number",
          category: "Numbers",
          sql_type: "INTEGER",
          default_max_length: nil,
          default_min_value: nil,
          default_max_value: nil,
          validation_regex: "^-?[0-9]+$",
          validation_message: "Must be a whole number (no decimals)",
          display_formatter: "whole_number",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Hash",
          example_values: "42",
          used_for: "Integer without decimal places"
        },
        {
          type_key: "currency",
          display_name: "Currency",
          category: "Numbers",
          sql_type: "NUMERIC(10,2)",
          default_max_length: nil,
          default_min_value: nil,
          default_max_value: nil,
          validation_regex: nil,
          validation_message: "Must be a valid currency amount",
          display_formatter: "currency",
          display_format: "$#,##0.00",
          link_template: nil,
          input_mask: nil,
          icon: "DollarSign",
          example_values: "$1,234.56",
          used_for: "Monetary value with 2 decimal places"
        },
        {
          type_key: "percentage",
          display_name: "Percentage",
          category: "Numbers",
          sql_type: "NUMERIC(5,2)",
          default_max_length: nil,
          default_min_value: 0,
          default_max_value: 100,
          validation_regex: nil,
          validation_message: "Must be between 0 and 100",
          display_formatter: "percentage",
          display_format: "#%",
          link_template: nil,
          input_mask: nil,
          icon: "Calculator",
          example_values: "75%",
          used_for: "Percentage value between 0-100"
        },
        # ============================================
        # DATE/TIME TYPES
        # ============================================
        {
          type_key: "date",
          display_name: "Date",
          category: "Date & Time",
          sql_type: "DATE",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: "Must be a valid date",
          display_formatter: "date",
          display_format: "dd/MM/yyyy",
          link_template: nil,
          input_mask: nil,
          icon: "Calendar",
          example_values: "25/12/2024",
          used_for: "Date without time component"
        },
        {
          type_key: "date_and_time",
          display_name: "Date and Time",
          category: "Date & Time",
          sql_type: "TIMESTAMP",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: "Must be a valid date and time",
          display_formatter: "datetime",
          display_format: "dd/MM/yyyy HH:mm",
          link_template: nil,
          input_mask: nil,
          icon: "Clock",
          example_values: "25/12/2024 14:30",
          used_for: "Date with time component"
        },
        # ============================================
        # SPECIAL TYPES
        # ============================================
        {
          type_key: "gps_coordinates",
          display_name: "GPS Coordinates",
          category: "Special",
          sql_type: "VARCHAR(100)",
          default_max_length: 100,
          validation_regex: '^-?[0-9]+\.?[0-9]*,\s*-?[0-9]+\.?[0-9]*$',
          validation_message: "Must be valid coordinates (lat,lng)",
          display_formatter: "gps",
          display_format: nil,
          link_template: "https://maps.google.com/?q={value}",
          input_mask: nil,
          icon: "MapPin",
          example_values: "-37.8136,144.9631",
          used_for: "Latitude,Longitude coordinates"
        },
        {
          type_key: "color_picker",
          display_name: "Color Picker",
          category: "Special",
          sql_type: "VARCHAR(7)",
          default_max_length: 7,
          validation_regex: "^#[0-9A-Fa-f]{6}$",
          validation_message: "Must be a hex color (#RRGGBB)",
          display_formatter: "color",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Palette",
          example_values: "#FF5733",
          used_for: "Hex color value (#RRGGBB)"
        },
        {
          type_key: "file_upload",
          display_name: "File Upload",
          category: "Special",
          sql_type: "TEXT",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "file",
          display_format: nil,
          link_template: "{value}",
          input_mask: nil,
          icon: "Paperclip",
          example_values: "/uploads/document.pdf",
          used_for: "File path or URL for uploaded files"
        },
        {
          type_key: "action_buttons",
          display_name: "Action Buttons",
          category: "Special",
          sql_type: "VARCHAR(255)",
          default_max_length: 255,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "actions",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Wrench",
          example_values: nil,
          used_for: "Configurable action buttons"
        },
        # ============================================
        # SELECTION TYPES
        # ============================================
        {
          type_key: "boolean",
          display_name: "Checkbox",
          category: "Selection",
          sql_type: "BOOLEAN",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "boolean",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "CheckCircle",
          example_values: "true/false",
          used_for: "True/false checkbox"
        },
        {
          type_key: "choice",
          display_name: "Choice",
          category: "Selection",
          sql_type: "VARCHAR(50)",
          default_max_length: 50,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "choice",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "List",
          example_values: "Option A, Option B",
          used_for: "Single selection from predefined options",
          needs_config: true
        },
        # ============================================
        # RELATIONSHIP TYPES
        # ============================================
        {
          type_key: "lookup",
          display_name: "Lookup",
          category: "Relationships",
          sql_type: "VARCHAR(255)",
          default_max_length: 255,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "lookup",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Search",
          example_values: nil,
          used_for: "Reference to another table (single value)",
          needs_config: true
        },
        {
          type_key: "multiple_lookups",
          display_name: "Multiple Lookups",
          category: "Relationships",
          sql_type: "TEXT",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "multiple_lookups",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Layers",
          example_values: nil,
          used_for: "Reference to another table (multiple values)",
          needs_config: true
        },
        {
          type_key: "user",
          display_name: "User",
          category: "Relationships",
          sql_type: "INTEGER",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "user",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "User",
          example_values: nil,
          used_for: "Reference to a system user"
        },
        {
          type_key: "computed",
          display_name: "Computed",
          category: "Relationships",
          sql_type: "VIRTUAL/COMPUTED",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "computed",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Calculator",
          example_values: nil,
          used_for: "Calculated field based on formula",
          needs_config: true
        },
        # ============================================
        # ADVANCED TYPES (PostgreSQL-specific)
        # ============================================
        {
          type_key: "structured_data",
          display_name: "Structured Data (JSON)",
          category: "Advanced",
          sql_type: "JSONB",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: "Must be valid JSON",
          display_formatter: "json",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Braces",
          example_values: '{"key": "value"}',
          used_for: "Flexible JSON objects for config, metadata, nested data"
        },
        {
          type_key: "array_of_items",
          display_name: "Array of Items",
          category: "Advanced",
          sql_type: "TEXT[]",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "array",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "List",
          example_values: '["tag1", "tag2"]',
          used_for: "Multiple text values stored as an array (tags, IDs)"
        },
        {
          type_key: "searchable_text",
          display_name: "Full-Text Search",
          category: "Advanced",
          sql_type: "TSVECTOR",
          default_max_length: nil,
          validation_regex: nil,
          validation_message: nil,
          display_formatter: "text",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "Search",
          example_values: nil,
          used_for: "Auto-generated search index (read-only)"
        },
        # ============================================
        # AUSTRALIAN STANDARD IDENTIFIERS
        # ============================================
        {
          type_key: "abn",
          display_name: "ABN",
          category: "Australian",
          sql_type: "VARCHAR(14)",
          default_max_length: 14,
          validation_regex: '^\d{11}$',
          validation_message: "Must be 11 digits",
          display_formatter: "australian_spaced",
          display_format: "XX XXX XXX XXX",
          link_template: "https://abr.business.gov.au/ABN/View?abn={value}",
          input_mask: "## ### ### ###",
          icon: "Building2",
          example_values: "51 824 753 556",
          used_for: "Australian Business Number (11 digits)"
        },
        {
          type_key: "acn",
          display_name: "ACN",
          category: "Australian",
          sql_type: "VARCHAR(11)",
          default_max_length: 11,
          validation_regex: '^\d{9}$',
          validation_message: "Must be 9 digits",
          display_formatter: "australian_spaced",
          display_format: "XXX XXX XXX",
          link_template: nil,
          input_mask: "### ### ###",
          icon: "Building2",
          example_values: "004 085 616",
          used_for: "Australian Company Number (9 digits)"
        },
        {
          type_key: "bsb",
          display_name: "BSB",
          category: "Australian",
          sql_type: "VARCHAR(7)",
          default_max_length: 7,
          validation_regex: '^\d{6}$',
          validation_message: "Must be 6 digits",
          display_formatter: "australian_dashed",
          display_format: "XXX-XXX",
          link_template: nil,
          input_mask: "###-###",
          icon: "Landmark",
          example_values: "063-000",
          used_for: "Bank State Branch (6 digits)"
        },
        {
          type_key: "bank_account",
          display_name: "Bank Account",
          category: "Australian",
          sql_type: "VARCHAR(9)",
          default_max_length: 9,
          validation_regex: '^\d{1,9}$',
          validation_message: "Must be up to 9 digits",
          display_formatter: "text",
          display_format: nil,
          link_template: nil,
          input_mask: nil,
          icon: "CreditCard",
          example_values: "12345678",
          used_for: "Bank Account Number (up to 9 digits)"
        },
        {
          type_key: "postcode",
          display_name: "Postcode",
          category: "Australian",
          sql_type: "VARCHAR(4)",
          default_max_length: 4,
          validation_regex: '^\d{4}$',
          validation_message: "Must be 4 digits",
          display_formatter: "postcode",
          display_format: "XXXX",
          link_template: nil,
          input_mask: "####",
          icon: "MapPin",
          example_values: "3000",
          used_for: "Australian Postcode (4 digits)"
        },
        {
          type_key: "tfn",
          display_name: "TFN",
          category: "Australian",
          sql_type: "VARCHAR(11)",
          default_max_length: 11,
          validation_regex: '^\d{9}$',
          validation_message: "Must be 9 digits",
          display_formatter: "australian_spaced",
          display_format: "XXX XXX XXX",
          link_template: nil,
          input_mask: "### ### ###",
          icon: "FileDigit",
          example_values: "123 456 789",
          used_for: "Tax File Number (9 digits)"
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

    desc "Link existing columns to their type definitions"
    task link_columns: :environment do
      puts "🔄 Linking columns to type definitions..."
      puts "=" * 80

      linked_count = 0
      skipped_count = 0

      # Get all columns without a type definition link (exclude system tables)
      columns = Column.joins(:foundation)
                      .where(column_type_definition_id: nil)
                      .where.not(foundations: { table_type: "system" })

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

    desc "Calculate compliance scores for all foundations"
    task calculate_compliance: :environment do
      puts "🔄 Calculating compliance scores..."
      puts "=" * 80

      results = GoldStandardComplianceService.recalculate_all!

      results.each do |result|
        status = result[:score] >= 100 ? "✅" : result[:score] >= 70 ? "⚠️" : "❌"
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

    desc "Run full Gold Standard setup (seed + link + calculate)"
    task setup: :environment do
      Rake::Task["teeem:gold_standard:seed_type_definitions"].invoke
      Rake::Task["teeem:gold_standard:link_columns"].invoke
      Rake::Task["teeem:gold_standard:calculate_compliance"].invoke
    end
  end
end
