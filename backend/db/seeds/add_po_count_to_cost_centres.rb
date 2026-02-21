# Add purchase_orders_count Foundation column to cost_centres
# Shows how many POs reference each cost centre (via SmTask/SmScheduleMaster chain)

puts "Adding purchase_orders_count column to cost_centres Foundation..."

foundation = Foundation.find_by(slug: 'cost_centres')
unless foundation
  puts "cost_centres Foundation not found"
  exit 1
end

unless foundation.columns.exists?(column_name: 'purchase_orders_count')
  max_position = foundation.columns.maximum(:position) || 0
  Column.create!(
    foundation_id: foundation.id,
    column_name: 'purchase_orders_count',
    name: 'PO Count',
    column_type: 'whole_number',
    position: max_position + 1
  )
  puts "Created purchase_orders_count column"
else
  puts "purchase_orders_count column already exists"
end

puts "Done!"
