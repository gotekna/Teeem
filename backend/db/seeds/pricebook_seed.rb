# Price Book Seed Data
puts "Seeding Price Book data..."

# Create suppliers
tl_supplier = Supplier.find_or_create_by!(name: "TL") do |s|
  s.contact_person = "John Smith"
  s.email = "john@tlsupply.com.au"
  s.phone = "1300 123 456"
  s.rating = 4
  s.response_rate = 85.5
  s.avg_response_time = 24
  s.notes = "Reliable electrical supplier"
end

bunnings = Supplier.find_or_create_by!(name: "Bunnings") do |s|
  s.contact_person = "Trade Desk"
  s.email = "trade@bunnings.com.au"
  s.phone = "1300 BUNNINGS"
  s.rating = 5
  s.response_rate = 95.0
  s.avg_response_time = 12
end

reece = Supplier.find_or_create_by!(name: "Reece Plumbing") do |s|
  s.contact_person = "Sarah Johnson"
  s.email = "sarah@reece.com.au"
  s.phone = "1300 REECE"
  s.rating = 5
  s.response_rate = 90.0
  s.avg_response_time = 18
  s.notes = "Premium plumbing supplies"
end

puts "Created #{Supplier.count} suppliers"

# Create electrical items
electrical_items = [
  {
    item_code: "DPP",
    item_name: "Wiring Double Power Point",
    category: "Electrical",
    current_price: 51.00,
    supplier: tl_supplier,
    unit_of_measure: "Each"
  },
  {
    item_code: "SPP",
    item_name: "Wiring Single Power Point",
    category: "Electrical",
    current_price: 50.00,
    supplier: tl_supplier,
    unit_of_measure: "Each"
  },
  {
    item_code: "ODPP",
    item_name: "Waterproof Double Power Point",
    category: "Electrical",
    current_price: 69.00,
    supplier: tl_supplier,
    unit_of_measure: "Each"
  },
  {
    item_code: "WEF",
    item_name: "Wiring Exhaust Fan",
    category: "Electrical",
    current_price: nil,
    supplier: nil,
    unit_of_measure: "Each",
    needs_pricing_review: true
  },
  {
    item_code: "WLP",
    item_name: "Wiring Light Point",
    category: "Electrical",
    current_price: 45.00,
    supplier: tl_supplier,
    unit_of_measure: "Each"
  },
  {
    item_code: "LED-DOWN",
    item_name: "LED Downlight 90mm",
    category: "Electrical",
    current_price: 12.50,
    supplier: bunnings,
    unit_of_measure: "Each",
    brand: "Brilliant"
  }
]

electrical_items.each do |item_data|
  PricebookItem.find_or_create_by!(item_code: item_data[:item_code]) do |item|
    item.assign_attributes(item_data)
  end
end

# Create plumbing items
plumbing_items = [
  {
    item_code: "TAP-KIT",
    item_name: "Kitchen Mixer Tap",
    category: "Plumbing",
    current_price: 285.00,
    supplier: reece,
    unit_of_measure: "Each",
    brand: "Phoenix"
  },
  {
    item_code: "TOILET-STD",
    item_name: "Standard Toilet Suite",
    category: "Plumbing",
    current_price: 395.00,
    supplier: reece,
    unit_of_measure: "Each",
    brand: "Caroma"
  },
  {
    item_code: "SHOWER-HEAD",
    item_name: "Rain Shower Head 250mm",
    category: "Plumbing",
    current_price: 165.00,
    supplier: reece,
    unit_of_measure: "Each",
    brand: "Methven"
  }
]

plumbing_items.each do |item_data|
  PricebookItem.find_or_create_by!(item_code: item_data[:item_code]) do |item|
    item.assign_attributes(item_data)
  end
end

# Create carpentry items
carpentry_items = [
  {
    item_code: "TIMBER-90x45",
    item_name: "Pine Framing Timber 90x45mm",
    category: "Carpentry",
    current_price: 8.50,
    supplier: bunnings,
    unit_of_measure: "Linear Metre",
    brand: "Treated Pine"
  },
  {
    item_code: "PLYWOOD-17",
    item_name: "Structural Plywood 17mm",
    category: "Carpentry",
    current_price: 65.00,
    supplier: bunnings,
    unit_of_measure: "Sheet"
  },
  {
    item_code: "DOOR-STD",
    item_name: "Standard Internal Door 2040x820mm",
    category: "Carpentry",
    current_price: 125.00,
    supplier: bunnings,
    unit_of_measure: "Each",
    brand: "Corinthian"
  }
]

carpentry_items.each do |item_data|
  PricebookItem.find_or_create_by!(item_code: item_data[:item_code]) do |item|
    item.assign_attributes(item_data)
  end
end

puts "Created #{PricebookItem.count} price book items"
puts "Items by category:"
PricebookItem.categories.each do |category|
  count = PricebookItem.by_category(category).count
  puts "  - #{category}: #{count}"
end
puts "Items needing pricing review: #{PricebookItem.needs_pricing.count}"
puts "Price Book seed complete!"
