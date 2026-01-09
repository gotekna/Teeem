# Add URL column to Gold Standard table
gold_standard = Table.find(166)

# Check for existing url columns
existing = gold_standard.columns.where(column_type: "url")
puts "Existing URL columns: #{existing.count}"

if existing.count > 0
  puts "URL column already exists - skipping"
else
  col = gold_standard.columns.create!(
    name: "URL",
    column_name: "website_url",
    column_type: "url",
    description: "Web URL field",
    position: gold_standard.columns.maximum(:position).to_i + 1
  )
  puts "Created URL column with ID: #{col.id}"

  # Rebuild table
  table_reloaded = Table.includes(:columns).find(166)
  builder = TableBuilder.new(table_reloaded)
  result = builder.create_database_table

  if result[:success]
    table_reloaded.reload_dynamic_model
    puts "Table rebuilt - Total columns: #{gold_standard.columns.reload.count}"
  else
    puts "Failed: #{result[:errors].inspect}"
  end
end
