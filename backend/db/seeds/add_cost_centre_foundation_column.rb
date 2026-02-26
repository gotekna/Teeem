# Add cost_centre_from_task Foundation column to purchase-orders
# Follows same pattern as stage_from_task and trade_from_task (expenses_tab_setup.rb)

puts "Adding cost_centre_from_task column to purchase-orders Foundation..."

foundation = Foundation.find_by(slug: 'purchase-orders')
unless foundation
  puts "purchase-orders Foundation not found"
  exit 1
end

unless foundation.columns.exists?(column_name: 'cost_centre_from_task')
  max_position = foundation.columns.maximum(:position) || 0
  Column.create!(
    foundation_id: foundation.id,
    column_name: 'cost_centre_from_task',
    name: 'Cost Centre',
    column_type: 'single_line_text',
    position: max_position + 1
  )
  puts "Created cost_centre_from_task column"
else
  puts "cost_centre_from_task column already exists"
end

puts "Done!"
