#!/usr/bin/env ruby
# frozen_string_literal: true

# Verify views after cleanup

table = Table.find_by(name: 'Price Books')
puts "Price Books Table ID: #{table.id}"
puts ""
puts "Remaining views for Price Books:"
TableView.where(table_id: table.id).order(:display_order).each do |view|
  puts "  - #{view.name} (ID: #{view.id}, display_order: #{view.display_order})"
  if view.columns && view.columns['visible']
    valid_cols = view.columns['visible'].select { |k, v| v == true && (table.columns.pluck(:column_name).include?(k) || [ 'select', 'actions' ].include?(k)) }
    invalid_cols = view.columns['visible'].select { |k, v| v == true && !table.columns.pluck(:column_name).include?(k) && ![ 'select', 'actions' ].include?(k) }
    puts "    Valid columns: #{valid_cols.keys.size}"
    puts "    Invalid columns: #{invalid_cols.keys.size} #{invalid_cols.keys.any? ? '❌ ' + invalid_cols.keys.join(', ') : '✅'}"
  end
end
puts ""
