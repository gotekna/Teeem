# Script to add missing column types to Gold Standard table
gold_standard = Table.find(166)

missing_columns = [
  {
    name: "URL",
    column_name: "url",
    column_type: "url",
    description: "Web URL field",
    position: gold_standard.columns.maximum(:position).to_i + 1
  },
  {
    name: "Date",
    column_name: "date_field",
    column_type: "date",
    description: "Date field (no time)",
    position: gold_standard.columns.maximum(:position).to_i + 2
  },
  {
    name: "Date and Time",
    column_name: "date_and_time",
    column_type: "date_and_time",
    description: "Date with time field",
    position: gold_standard.columns.maximum(:position).to_i + 3
  },
  {
    name: "Whole Number",
    column_name: "whole_number",
    column_type: "whole_number",
    description: "Integer field",
    position: gold_standard.columns.maximum(:position).to_i + 4
  },
  {
    name: "Lookup",
    column_name: "lookup_field",
    column_type: "lookup",
    description: "Link to another record",
    lookup_table_id: 166,
    lookup_display_column: "item_code",
    position: gold_standard.columns.maximum(:position).to_i + 5
  },
  {
    name: "User",
    column_name: "user_field",
    column_type: "user",
    description: "User field",
    position: gold_standard.columns.maximum(:position).to_i + 6
  },
  {
    name: "Computed",
    column_name: "computed_field",
    column_type: "computed",
    description: "Computed/formula field",
    settings: { formula: "CONCAT([item_code])" }.to_json,
    position: gold_standard.columns.maximum(:position).to_i + 7
  }
]

created_count = 0
missing_columns.each do |col_attrs|
  existing = gold_standard.columns.find_by(column_name: col_attrs[:column_name])
  if existing
    puts "- Column already exists: #{col_attrs[:name]}"
  else
    begin
      gold_standard.columns.create!(col_attrs)
      puts "✓ Created column: #{col_attrs[:name]}"
      created_count += 1
    rescue => e
      puts "✗ Error creating #{col_attrs[:name]}: #{e.message}"
    end
  end
end

if created_count > 0
  puts "\nRebuilding database table..."
  table_reloaded = Table.includes(:columns).find(166)
  builder = TableBuilder.new(table_reloaded)
  result = builder.create_database_table

  if result[:success]
    puts "✓ Gold Standard table rebuilt successfully with #{created_count} new columns"
    table_reloaded.reload_dynamic_model
    puts "✓ Dynamic model reloaded"
  else
    puts "✗ Failed to rebuild table: #{result[:errors].inspect}"
  end
else
  puts "\nNo new columns to add"
end

puts "\nFinal column count: #{gold_standard.columns.reload.count}"
