namespace :trapid do
  desc "Update validation rules for all column types in Gold Standard table"
  task update_validation_rules: :environment do
    puts "🔧 Updating validation rules for Gold Standard Reference table columns..."

    gold_standard_table = Table.find_by(id: 1) || Table.find_by(name: 'Gold Standard Reference')

    unless gold_standard_table
      puts "❌ Gold Standard Reference table not found"
      exit 1
    end

    # Validation rules mapping based on implemented behaviors
    validation_rules = {
      'email' => {
        description: "Email address with validation. Must match format: user@domain.com. Invalid emails show red background. Valid emails show blue underlined mailto link.",
        validation_message: "Must be a valid email address (e.g., user@example.com)"
      },
      'phone' => {
        description: "Australian landline phone number. Auto-formats to (0X) XXXX XXXX. Detects area codes for 8-digit numbers. Invalid formats show red background.",
        validation_message: "Must contain only digits, spaces, hyphens, parentheses, or plus sign"
      },
      'mobile' => {
        description: "Australian mobile number. Auto-formats to 04XX XXX XXX format. Invalid formats show red background.",
        validation_message: "Must be a valid Australian mobile number (10 digits starting with 04)"
      },
      'url' => {
        description: "Website URL with validation. Accepts URLs with or without http/https protocol. Displays as blue underlined clickable link. Opens in new tab.",
        validation_message: "Must be a valid URL (e.g., example.com or https://example.com)"
      },
      'number' => {
        description: "Decimal number field. Right-aligned. Allows decimal values. Validates numeric input only. Shows red background if non-numeric.",
        validation_message: "Must be a valid number (integer or decimal)"
      },
      'whole_number' => {
        description: "Integer number field. Right-aligned. Only whole numbers allowed. Validates numeric input only.",
        validation_message: "Must be a valid whole number (no decimals)"
      },
      'currency' => {
        description: "Currency field with $ prefix. Right-aligned. Formats to 2 decimal places (e.g., $1,234.56). Australian locale formatting with commas.",
        validation_message: "Must be a valid currency amount (e.g., 99.95)"
      },
      'percentage' => {
        description: "Percentage value field. Right-aligned. Validates numeric input.",
        validation_message: "Must be a valid number representing a percentage"
      },
      'date' => {
        description: "Date field. Validates date format. Shows red background if invalid date.",
        validation_message: "Must be a valid date"
      },
      'date_and_time' => {
        description: "Date and time field. Validates date/time format. Shows red background if invalid.",
        validation_message: "Must be a valid date and time"
      },
      'single_line_text' => {
        description: "Single line text input. No validation. Accepts any text value up to 255 characters.",
        validation_message: nil
      },
      'multiple_lines_text' => {
        description: "Multi-line text area. No validation. Accepts any text value. Expandable editor available.",
        validation_message: nil
      },
      'gps_coordinates' => {
        description: "GPS coordinates field. No validation currently implemented.",
        validation_message: nil
      },
      'color_picker' => {
        description: "Color picker field for hex color codes (e.g., #FF5733). No validation currently implemented.",
        validation_message: nil
      },
      'file_upload' => {
        description: "File upload field for document/image attachments. No validation currently implemented.",
        validation_message: nil
      },
      'action_buttons' => {
        description: "JSON field storing button configurations with labels and actions. No validation currently implemented.",
        validation_message: nil
      },
      'boolean' => {
        description: "Boolean checkbox field. Stores true/false values. No validation needed.",
        validation_message: nil
      },
      'choice' => {
        description: "Single selection dropdown field. No validation currently implemented.",
        validation_message: nil
      },
      'lookup' => {
        description: "Single lookup/reference to another table record. No validation currently implemented.",
        validation_message: nil
      },
      'multiple_lookups' => {
        description: "Multiple lookup/reference field linking to multiple records. No validation currently implemented.",
        validation_message: nil
      },
      'user' => {
        description: "User assignment field. Links to user records. No validation currently implemented.",
        validation_message: nil
      },
      'computed' => {
        description: "Computed/calculated field. Read-only. Value generated from formula. No user input or validation.",
        validation_message: nil
      }
    }

    updated_count = 0

    validation_rules.each do |column_type, rules|
      column = gold_standard_table.columns.find_by(column_type: column_type)

      if column
        # Use update_columns to skip validations (lookup columns need lookup_table_id)
        column.update_columns(
          description: rules[:description],
          validation_message: rules[:validation_message]
        )
        puts "✅ Updated: #{column_type}"
        updated_count += 1
      else
        puts "⚠️  Not found: #{column_type}"
      end
    end

    puts "\n📊 Summary:"
    puts "   Columns updated: #{updated_count}"
    puts "   Total validation rules: #{validation_rules.count}"
    puts "\n✨ Validation rules updated successfully!"
  end
end
