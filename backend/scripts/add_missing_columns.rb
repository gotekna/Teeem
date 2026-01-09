#!/usr/bin/env ruby
# Script to add all missing columns to the columns table

# Map SQL types to our column_type system (must match Column model validations)
def map_column_type(sql_type, column_name)
  # Check for special column patterns first
  case column_name
  when /email/i
    return 'email'
  when /phone/i, /mobile/i
    return 'phone'
  when /url/i, /link/i
    return 'url'
  when /_id$/, /^id$/
    return 'whole_number'
  end

  # Then check SQL type
  case sql_type.to_s
  when /^character varying/, /^varchar/
    'single_line_text'
  when /^text/
    'multiple_lines_text'
  when /^string/
    'single_line_text'
  when /^integer/, /^bigint/, /^smallint/
    'whole_number'
  when /^decimal/, /^numeric/
    'number'
  when /^float/, /^double/
    'number'
  when /^boolean/
    'boolean'
  when /^date$/
    'date'
  when /^timestamp/, /^datetime/
    'date_and_time'
  when /^jsonb/, /^json/
    'multiple_lines_text'  # Store JSON as text
  when /^array/
    'multiple_lines_text'  # Store arrays as text
  else
    'single_line_text'  # default fallback
  end
end

puts '=== ADDING MISSING COLUMNS ==='
puts ''

all_tables = Table.all
added_count = 0

all_tables.each do |table|
  # Find database table name
  possible_names = [
    table.name.downcase.gsub(' ', '_'),
    table.name.downcase.gsub(' ', '_').singularize,
    table.name.downcase.gsub(' ', '_').pluralize
  ]

  table_name = nil
  possible_names.each do |name|
    if ActiveRecord::Base.connection.table_exists?(name)
      table_name = name
      break
    end
  end

  next unless table_name

  begin
    schema_cols = ActiveRecord::Base.connection.columns(table_name)
    db_col_names = Column.where(table_id: table.id).pluck(:column_name)

    # Get the max position for ordering
    max_position = Column.where(table_id: table.id).maximum(:position) || 0

    schema_cols.each do |col|
      next if db_col_names.include?(col.name)

      # Add missing column
      column_type = map_column_type(col.type, col.name)

      new_col = Column.create!(
        table_id: table.id,
        column_name: col.name,
        name: col.name.titleize,
        column_type: column_type,
        required: !col.null,
        default_value: col.default,
        position: max_position + 1,
        searchable: [ 'single_line_text', 'email', 'multiple_lines_text' ].include?(column_type)
      )

      puts "✅ Added: #{table.name}.#{col.name} (#{column_type})"
      added_count += 1
      max_position += 1
    end

  rescue => e
    puts "❌ Error with #{table.name}: #{e.message}"
  end
end

puts ''
puts "Total columns added: #{added_count}"
