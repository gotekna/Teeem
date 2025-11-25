#!/usr/bin/env ruby
# Export all contacts table columns in a format ready for frontend

require_relative '../config/environment'

columns = Column.where(table_id: 214).order(:position)

puts "// All #{columns.count} columns for Contacts table"
puts "const contactColumnsConfig = {"

columns.each do |col|
  searchable = col.searchable ? 'true' : 'false'
  filter_type = case col.column_type
  when 'choice', 'multiple_choice', 'boolean'
    "'dropdown'"
  when 'single_line_text', 'email', 'phone', 'mobile'
    "'search'"
  else
    "null"
  end

  puts "  #{col.column_name}: { key: '#{col.column_name}', label: '#{col.name}', searchable: #{searchable}, filterType: #{filter_type} },"
end

# Add pseudo columns
puts "  actions: { key: 'actions', label: 'Actions', searchable: false, filterType: null }"
puts "}"
