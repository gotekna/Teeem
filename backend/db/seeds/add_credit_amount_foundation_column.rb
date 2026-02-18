# Add credit_amount and net_total Foundation columns to purchase-orders
# These virtual columns expose credit note data in the Foundation API

puts "Adding credit_amount and net_total columns to purchase-orders Foundation..."

foundation = Foundation.find_by(slug: 'purchase-orders')
unless foundation
  puts "purchase-orders Foundation not found"
  exit 1
end

# credit_amount - stored column
unless foundation.columns.exists?(column_name: 'credit_amount')
  max_position = foundation.columns.maximum(:position) || 0
  Column.create!(
    foundation_id: foundation.id,
    column_name: 'credit_amount',
    name: 'Credit Notes',
    column_type: 'currency',
    position: max_position + 1
  )
  puts "Created credit_amount column"
else
  puts "credit_amount column already exists"
end

# net_total - virtual column (total - credit_amount)
unless foundation.columns.exists?(column_name: 'net_total')
  max_position = foundation.columns.maximum(:position) || 0
  Column.create!(
    foundation_id: foundation.id,
    column_name: 'net_total',
    name: 'Net Total',
    column_type: 'currency',
    position: max_position + 1
  )
  puts "Created net_total column"
else
  puts "net_total column already exists"
end

puts "Done!"
