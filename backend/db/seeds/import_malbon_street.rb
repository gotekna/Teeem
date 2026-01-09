require 'csv'

# Helper methods
def extract_category_from_description(desc)
  return 'UNKNOWN' if desc.blank?

  desc_lower = desc.downcase

  case desc_lower
  when /plaster|gyprock/i then 'PLASTERER'
  when /paint/i then 'PAINTER'
  when /concrete|slab|driveway/i then 'CONCRETE'
  when /plumb/i then 'PLUMBER'
  when /electric/i then 'ELECTRICAL'
  when /carpenter|frame|timber/i then 'CARPENTER'
  when /roof|fascia|gutter/i then 'ROOFING'
  when /tile/i then 'TILER'
  when /surveyor|survey/i then 'SURVEYOR'
  when /site cut|excavat/i then 'SITE_PREP'
  when /termite|smart-film/i then 'TERMITE'
  when /waterproof/i then 'WATERPROOF'
  when /window/i then 'WINDOWS'
  when /door/i then 'DOORS'
  when /kitchen/i then 'KITCHEN'
  when /hot water/i then 'PLUMBER'
  when /shower/i then 'PLUMBER'
  when /steel/i then 'STEEL'
  when /inspection|engineer/i then 'ADMIN'
  when /soil test|wind rating/i then 'ADMIN'
  when /clean/i then 'CLEANING'
  when /qleave|approval/i then 'ADMIN'
  when /fence/i then 'FENCING'
  else 'MATERIALS'
  end
end

def should_create_schedule_task?(desc)
  return false if desc.blank?

  # Skip financial/admin tasks that don't affect schedule
  skip_keywords = [ 'pay external sales', 'retail profit', 'contingency', 'feaso' ]
  desc_lower = desc.downcase

  !skip_keywords.any? { |keyword| desc_lower.include?(keyword) }
end

def estimate_required_date(desc, start_date)
  # Estimate when materials/services are needed based on construction phase
  # This is a rough estimate - real dates would come from actual schedule

  desc_lower = desc.to_s.downcase

  case desc_lower
  when /soil|survey|approval|qleave/ then start_date + 5.days
  when /site cut|excavat/ then start_date + 14.days
  when /drain|underground/ then start_date + 20.days
  when /concrete.*slab|wafflepod/ then start_date + 30.days
  when /frame|carpenter/ then start_date + 40.days
  when /roof|fascia|gutter/ then start_date + 50.days
  when /window|door/ then start_date + 55.days
  when /plaster/ then start_date + 65.days
  when /paint/ then start_date + 75.days
  when /tile/ then start_date + 70.days
  when /kitchen/ then start_date + 72.days
  when /driveway/ then start_date + 85.days
  when /clean/ then start_date + 95.days
  else start_date + 60.days # Default mid-construction
  end
end

puts "🏗️  Importing Malbon Street Construction Job from CSV..."

# Find the CSV file
csv_path = Rails.root.join('..', 'easybuildapp development Purchase Orders-3.csv')

unless File.exist?(csv_path)
  puts "❌ CSV file not found at: #{csv_path}"
  exit
end

# Get or create a user to be the project manager
user = User.first
unless user
  puts "❌ No users found. Please create a user first."
  exit
end

# Find or create the construction job
construction = Construction.find_or_create_by!(id: 90) do |c|
  c.title = "Lot 0 (56a) Malbon street, Eight Mile Plains, QLD"
  c.status = "Active"
end
puts "✓ Construction: #{construction.title} (ID: #{construction.id})"

# Parse CSV and import POs
csv_data = CSV.read(csv_path, headers: true)
po_count = 0
skipped_count = 0
supplier_cache = {}

csv_data.each do |row|
  next if row['purchase_order_number'].blank?

  # Skip if PO already exists
  if PurchaseOrder.exists?(purchase_order_number: row['purchase_order_number'])
    skipped_count += 1
    next
  end

  # Extract data from CSV
  po_number = row['purchase_order_number']
  total = row['total'].to_f
  sub_total = row['sub_total'].to_f
  tax = row['tax'].to_f
  description = row['ted_task'] || row['supplier'] || 'Unknown Task'
  supplier_name = row['supplier']
  xero_complete = row['xero_complete'] == 'true'

  # Find or create supplier
  supplier = nil
  if supplier_name.present?
    supplier = supplier_cache[supplier_name] ||= Supplier.find_or_create_by!(name: supplier_name)
  end

  # Determine task category from description
  task_category = extract_category_from_description(description)

  # Create the purchase order
  begin
    po = construction.purchase_orders.create!(
      purchase_order_number: po_number,
      status: xero_complete ? 'paid' : 'approved',
      description: description,
      supplier: supplier,
      sub_total: sub_total,
      tax: tax,
      total: total,
      task_category: task_category,
      creates_schedule_tasks: should_create_schedule_task?(description),
      required_on_site_date: estimate_required_date(description, Date.current)
    )
    po_count += 1
    print "."
  rescue => e
    puts "\n❌ Error creating PO #{po_number}: #{e.message}"
  end
end

puts "\n✓ Imported #{po_count} purchase orders"
puts "  Skipped #{skipped_count} existing POs"

# Summary
total_budget = construction.purchase_orders.sum(&:total)
puts "\n📊 Construction Summary:"
puts "  Total POs: #{construction.purchase_orders.count}"
puts "  Total Budget: $#{total_budget.round(2)}"
puts "  POs for Schedule: #{construction.purchase_orders.for_schedule.count}"

puts "\n✅ Malbon Street construction job imported successfully!"
puts "Ready to create project and generate schedule 🚀"
