# Register sm_schedule_master_template_ids as a Foundation column on cost_centres
# Needed for TeeemTableView's initialFilters to work with array_contains operator
# Column is hidden from table UI (has_ui: false) - used for template dropdown filtering only

puts "Adding sm_schedule_master_template_ids column to cost_centres Foundation..."

foundation = Foundation.find_by(slug: 'cost_centres')
unless foundation
  puts "cost_centres Foundation not found"
  exit 1
end

unless foundation.columns.exists?(column_name: 'sm_schedule_master_template_ids')
  max_position = foundation.columns.maximum(:position) || 0
  Column.create!(
    foundation_id: foundation.id,
    column_name: 'sm_schedule_master_template_ids',
    name: 'Templates',
    column_type: 'single_line_text',
    position: max_position + 1,
    has_ui: false
  )
  puts "Created sm_schedule_master_template_ids column"
else
  puts "sm_schedule_master_template_ids column already exists"
end

puts "Done!"
