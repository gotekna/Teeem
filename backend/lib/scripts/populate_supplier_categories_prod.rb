# Populate supplier categories from existing pricebook data
puts "=" * 80
puts "Populating Supplier Categories from Database"
puts "=" * 80

# Get all pricebook items with suppliers and categories
items = PricebookItem.where.not(supplier_id: nil, category: nil)

puts "\n1. Analyzing database..."
puts "   Found #{items.count} items with supplier and category"

# Group by supplier and count categories
supplier_categories = {}
items.pluck(:supplier_id, :category).each do |supplier_id, category|
  supplier_categories[supplier_id] ||= Hash.new(0)
  supplier_categories[supplier_id][category] += 1
end

puts "   Found #{supplier_categories.keys.count} suppliers"
puts "   Found #{supplier_categories.values.flat_map(&:keys).uniq.count} unique categories"

puts "\n2. Updating suppliers in database..."
updated = 0
skipped = 0

supplier_categories.each do |supplier_id, categories|
  supplier = Supplier.find_by(id: supplier_id)

  unless supplier
    puts "   Skipping supplier ID #{supplier_id} (not found)"
    skipped += 1
    next
  end

  # Find primary category (most items)
  primary_category = categories.max_by { |cat, count| count }&.first

  # Create arrays for the fields (filter out nil categories)
  all_categories = categories.keys.compact.sort

  supplier.update!(
    trade_categories: all_categories,
    is_default_for_trades: [ primary_category ].compact
  )

  puts "   Updated: #{supplier.name}"
  updated += 1
end

puts "\n" + "=" * 80
puts "Summary:"
puts "  Updated: #{updated} suppliers"
puts "  Skipped: #{skipped} suppliers"
puts "=" * 80

# Show some examples
puts "\n" + "=" * 80
puts "Examples of updated suppliers:"
puts "=" * 80

Supplier.where.not(trade_categories: nil).limit(10).each do |supplier|
  next if supplier.trade_categories.empty?

  puts "\n#{supplier.name}"
  puts "  Primary: #{supplier.is_default_for_trades&.first || 'None'}"
  puts "  All categories: #{supplier.trade_categories.join(', ')}"
end

puts "\n" + "=" * 80
puts "Task completed successfully!"
puts "=" * 80
