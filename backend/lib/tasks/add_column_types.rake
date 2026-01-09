namespace :trinity do
  desc "Add Column Type metadata to Trinity as single source of truth"
  task add_column_types: :environment do
    puts "🔄 Adding Column Type metadata to Trinity..."
    puts ""

    # Column types from frontend/src/constants/columnTypes.js
    # UPDATED 2025-11-19: Synced with frontend single source of truth
    column_types = [
      # Text Fields
      {
        value: "single_line_text",
        label: "Single line text",
        category: "Text",
        description: "Short text (up to 255 characters)",
        sql_type: "VARCHAR(255)",
        validation_rules: "Optional text field, max 255 characters, alphanumeric",
        example: "CONC-001, STL-042A",
        used_for: "Unique identifier code for inventory"
      },
      {
        value: "multiple_lines_text",
        label: "Long text",
        category: "Text",
        description: "Multi-line text field",
        sql_type: "TEXT",
        validation_rules: "Optional text field, supports line breaks",
        example: 'Additional notes\nSecond line\nThird line',
        used_for: "Notes, comments, multi-line descriptions"
      },
      {
        value: "email",
        label: "Email",
        category: "Text",
        description: "Email address",
        sql_type: "VARCHAR(255)",
        validation_rules: "Must contain @ symbol, valid email format",
        example: "supplier@example.com, contact@business.com.au",
        used_for: "Email addresses for contacts"
      },
      {
        value: "phone",
        label: "Phone number",
        category: "Text",
        description: "Phone number",
        sql_type: "VARCHAR(20)",
        validation_rules: "Format: (03) 9123 4567 or 1300 numbers",
        example: "(03) 9123 4567, 1300 123 456",
        used_for: "Landline phone numbers"
      },
      {
        value: "mobile",
        label: "Mobile",
        category: "Text",
        description: "Mobile phone number",
        sql_type: "VARCHAR(20)",
        validation_rules: "Format: 0407 397 541, starts with 04",
        example: "0407 397 541, 0412 345 678",
        used_for: "Mobile phone numbers"
      },
      {
        value: "url",
        label: "URL",
        category: "Text",
        description: "Website URL",
        sql_type: "VARCHAR(500)",
        validation_rules: "Valid URL format, clickable in table",
        example: "https://example.com/doc.pdf",
        used_for: "Links to external documents or files"
      },
      # Number Fields
      {
        value: "number",
        label: "Number",
        category: "Numbers",
        description: "Integer number",
        sql_type: "INTEGER",
        validation_rules: "Integers (positive or negative), shows sum in footer",
        example: "10, 250, 15, -5",
        used_for: "Quantity of items, counts, or any integer value"
      },
      {
        value: "whole_number",
        label: "Whole number",
        category: "Numbers",
        description: "Integer number",
        sql_type: "INTEGER",
        validation_rules: "Integers only (no decimals), shows sum",
        example: "5, 100, 42",
        used_for: "Counts, units, days - no fractional values"
      },
      {
        value: "currency",
        label: "Currency",
        category: "Numbers",
        description: "Money amount",
        sql_type: "NUMERIC(10,2)",
        validation_rules: "Positive numbers, 2 decimal places, shows sum in footer",
        example: "$125.50, $1,234.99",
        used_for: "Price in Australian dollars"
      },
      {
        value: "percentage",
        label: "Percent",
        category: "Numbers",
        description: "Percentage value",
        sql_type: "NUMERIC(5,2)",
        validation_rules: "0-100, input as number (e.g., 11), displayed with % symbol (e.g., 11%)",
        example: "Input: 11 → Display: 11%, Input: 25.5 → Display: 25.5%",
        used_for: "Discount percentage for pricing"
      },
      # Date & Time
      {
        value: "date",
        label: "Date",
        category: "Date & Time",
        description: "Date only",
        sql_type: "DATE",
        validation_rules: "Stored as YYYY-MM-DD (sortable), displayed as DD-MM-YYYY (Australian format)",
        example: "Display: 19-11-2025, Stored: 2025-11-19",
        used_for: "Date values without time, for contracts, events, start dates"
      },
      {
        value: "date_and_time",
        label: "Date & Time",
        category: "Date & Time",
        description: "Date and time",
        sql_type: "TIMESTAMP",
        validation_rules: "Stored as YYYY-MM-DD HH:MM:SS (sortable), displayed as DD-MM-YYYY HH:MM (Australian format)",
        example: "Display: 19-11-2025 14:30, Stored: 2025-11-19 14:30:00",
        used_for: "Timestamps, event times, scheduled dates with time"
      },
      # Special Types
      {
        value: "gps_coordinates",
        label: "GPS Coordinates",
        category: "Special",
        description: "Latitude and Longitude",
        sql_type: "VARCHAR(100)",
        validation_rules: "Latitude, Longitude format",
        example: "-33.8688, 151.2093 (Sydney)",
        used_for: "GPS coordinates for job sites, delivery addresses, asset tracking"
      },
      {
        value: "color_picker",
        label: "Color Picker",
        category: "Special",
        description: "Hex color code",
        sql_type: "VARCHAR(7)",
        validation_rules: "Hex color format (#RRGGBB)",
        example: "#FF5733, #3498DB, #000000",
        used_for: "Visual categorization, status indicators, UI customization"
      },
      {
        value: "file_upload",
        label: "File Upload",
        category: "Special",
        description: "File attachment reference",
        sql_type: "TEXT",
        validation_rules: "File path or URL to uploaded file",
        example: "/uploads/doc.pdf, https://example.com/file.png",
        used_for: "File references, document links, image paths"
      },
      # Selection & Boolean
      {
        value: "boolean",
        label: "Checkbox",
        category: "Selection",
        description: "True/false value",
        sql_type: "BOOLEAN",
        validation_rules: "True or False only",
        example: "true, false",
        used_for: "Active/inactive status flag"
      },
      {
        value: "choice",
        label: "Single select",
        category: "Selection",
        description: "Select one option from a list",
        sql_type: "VARCHAR(50)",
        validation_rules: "Must be one of predefined options, displayed with colored badges",
        example: "active, pending, completed, cancelled",
        used_for: "Status fields, workflow states, categories with visual indicators"
      },
      # Relationships
      {
        value: "lookup",
        label: "Link to another record",
        category: "Relationships",
        description: "Link to records in another table",
        sql_type: "VARCHAR(255)",
        validation_rules: "Must reference a valid value from the linked table/list",
        example: "Product #123, Category: Materials, Customer: ACME Corp",
        used_for: "Foreign key relationships, dropdown selections from other tables"
      },
      {
        value: "multiple_lookups",
        label: "Link to multiple records",
        category: "Relationships",
        description: "Link to multiple records",
        sql_type: "TEXT",
        validation_rules: "Array of IDs stored as JSON",
        example: "[1, 5, 12]",
        used_for: "Multiple relationships to other records"
      },
      {
        value: "user",
        label: "User",
        category: "Relationships",
        description: "Link to a user",
        sql_type: "INTEGER",
        validation_rules: "Must reference valid user ID",
        example: "User #7, User #1",
        used_for: "Assignment to users, ownership tracking"
      },
      # Computed
      {
        value: "computed",
        label: "Formula",
        category: "Computed",
        description: "Calculated value based on other fields",
        sql_type: "VIRTUAL/COMPUTED",
        validation_rules: "Read-only, calculated from formula (e.g., A × B, SUM(C), LOOKUP(D))",
        example: "$1,255.00 (price × quantity), Total: $15,000 (SUM of all rows)",
        used_for: "Automatic calculations, aggregations, cross-table lookups"
      }
    ]

    puts "Creating Trinity entries for #{column_types.length} column types..."
    puts ""

    # Get the highest section number in Chapter 19
    max_section = Trinity.where(category: "teacher", chapter_number: 19)
                         .pluck(:section_number)
                         .map { |sn| sn.match(/T19\.(\d+)$/)&.[](1)&.to_i }
                         .compact
                         .max || 0

    puts "Starting from section T19.#{(max_section + 1).to_s.rjust(3, '0')}"
    puts ""

    created_count = 0
    column_types.each_with_index do |col_type, index|
      section_num = max_section + index + 1
      section_number = "T19.#{section_num.to_s.rjust(3, '0')}"

      # Check if already exists
      existing = Trinity.find_by(
        category: "teacher",
        chapter_number: 19,
        title: "Column Type: #{col_type[:label]}"
      )

      if existing
        puts "  ⏭️  #{section_number} - #{col_type[:label]} (already exists)"
        next
      end

      Trinity.create!(
        category: "teacher",
        chapter_number: 19,
        chapter_name: "Custom Tables & Formulas",
        section_number: section_number,
        title: "Column Type: #{col_type[:label]}",
        component: "table",
        entry_type: "REFERENCE",
        description: "#{col_type[:label]} (#{col_type[:value]}) - #{col_type[:description]}. Category: #{col_type[:category]}. SQL Type: #{col_type[:sql_type]}. Validation Rules: #{col_type[:validation_rules]}. Example: #{col_type[:example]}. Used For: #{col_type[:used_for]}",
        details: "Frontend Value: #{col_type[:value]}. Display Label: #{col_type[:label]}. SQL Mapping: #{col_type[:sql_type]}",
        metadata: {
          column_type_value: col_type[:value],
          column_type_label: col_type[:label],
          column_type_category: col_type[:category],
          sql_type: col_type[:sql_type],
          validation_rules: col_type[:validation_rules],
          example: col_type[:example],
          used_for: col_type[:used_for]
        }
      )

      puts "  ✅ #{section_number} - #{col_type[:label]}"
      created_count += 1
    end

    puts ""
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ Column Type Import Complete!"
    puts "   Created: #{created_count} entries"
    puts "   Skipped: #{column_types.length - created_count} (already exist)"
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts ""
    puts "API Endpoint to access:"
    puts "  GET /api/v1/trinity?category=teacher&chapter=19&component=table"
    puts ""
  end
end
