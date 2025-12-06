# Import Malbon Street Construction Job to Production
# This script creates the construction, imports POs, creates project, and generates schedule

puts "🏗️  Importing Malbon Street Construction Job..."
puts ""

# Get first user for project manager
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

# Sample Purchase Orders data (abbreviated - add more as needed)
po_data = [
  { po_number: "PO-053486", description: "DO - Load Invoices into XERO", supplier: "Admin", total: 0, category: "ADMIN", creates_schedule: true },
  { po_number: "PO-054132", description: "GET - Finance Approval", supplier: "Bank", total: 0, category: "ADMIN", creates_schedule: true },
  { po_number: "PO-054167", description: "CREATE - Contract", supplier: "Legal", total: 0, category: "ADMIN", creates_schedule: true },
  { po_number: "PO-054168", description: "ORDER - Soil Test", supplier: "Testing Co", total: 2500, category: "ADMIN", creates_schedule: true },
  { po_number: "PO-054169", description: "Req Site Cut", supplier: "Excavation", total: 8500, category: "SITE_PREP", creates_schedule: true },
  { po_number: "PO-054170", description: "Req Concreter For Complete Slab", supplier: "Concrete Co", total: 35000, category: "CONCRETE", creates_schedule: true },
  { po_number: "PO-054171", description: "ORDER - Frame", supplier: "Timber Supplier", total: 45000, category: "CARPENTER", creates_schedule: true },
  { po_number: "PO-054172", description: "Req Carpenter Ground Floor", supplier: "Carpentry", total: 28000, category: "CARPENTER", creates_schedule: true },
  { po_number: "PO-054173", description: "ORDER - Roof", supplier: "Roofing Supplies", total: 18000, category: "ROOFING", creates_schedule: true },
  { po_number: "PO-054174", description: "Req Fascia and Gutter and Colorbond Roof", supplier: "Roofing Co", total: 15000, category: "ROOFING", creates_schedule: true },
  { po_number: "PO-054175", description: "Req Electrician - Prewire", supplier: "Sparky", total: 12000, category: "ELECTRICAL", creates_schedule: true },
  { po_number: "PO-054176", description: "Req Plumber Rough In", supplier: "Plumbing Co", total: 11000, category: "PLUMBER", creates_schedule: true },
  { po_number: "PO-054177", description: "Req Plaster Board", supplier: "Plasterer", total: 16000, category: "PLASTERER", creates_schedule: true },
  { po_number: "PO-054178", description: "ORDER - Kitchen Parts", supplier: "Kitchen Co", total: 25000, category: "KITCHEN", creates_schedule: true },
  { po_number: "PO-054179", description: "Req Tiler", supplier: "Tiling Co", total: 14000, category: "TILER", creates_schedule: true },
  { po_number: "PO-054180", description: "Req Painter Internal House", supplier: "Painting Co", total: 18000, category: "PAINTER", creates_schedule: true },
  { po_number: "PO-054181", description: "Req Electrician - Fit Off", supplier: "Sparky", total: 8000, category: "ELECTRICAL", creates_schedule: true },
  { po_number: "PO-054182", description: "Req Plumber - Fit Off", supplier: "Plumbing Co", total: 6000, category: "PLUMBER", creates_schedule: true },
  { po_number: "PO-054183", description: "Req Builders Clean", supplier: "Cleaning Co", total: 2500, category: "CLEANING", creates_schedule: true },
  { po_number: "PO-054184", description: "Do Council Final Inspection", supplier: "Council", total: 500, category: "ADMIN", creates_schedule: true }
]

# Import Purchase Orders
po_count = 0
po_data.each do |po_info|
  # Skip if already exists
  if PurchaseOrder.exists?(purchase_order_number: po_info[:po_number])
    next
  end

  # Find or create supplier
  supplier = nil
  if po_info[:supplier].present?
    supplier = Supplier.find_or_create_by!(name: po_info[:supplier])
  end

  # Calculate dates
  start_date = Date.current
  required_date = case po_info[:category]
  when 'ADMIN' then start_date + 5.days
  when 'SITE_PREP' then start_date + 14.days
  when 'CONCRETE' then start_date + 30.days
  when 'CARPENTER' then start_date + 40.days
  when 'ROOFING' then start_date + 50.days
  when 'ELECTRICAL' then start_date + 55.days
  when 'PLUMBER' then start_date + 55.days
  when 'PLASTERER' then start_date + 65.days
  when 'KITCHEN' then start_date + 72.days
  when 'TILER' then start_date + 70.days
  when 'PAINTER' then start_date + 75.days
  when 'CLEANING' then start_date + 95.days
  else start_date + 60.days
  end

  # Create PO
  construction.purchase_orders.create!(
    purchase_order_number: po_info[:po_number],
    status: 'approved',
    description: po_info[:description],
    supplier: supplier,
    sub_total: (po_info[:total] * 0.9).round(2),
    tax: (po_info[:total] * 0.1).round(2),
    total: po_info[:total],
    task_category: po_info[:category],
    creates_schedule_tasks: po_info[:creates_schedule],
    required_on_site_date: required_date
  )
  po_count += 1
  print "."
end

puts ""
puts "✓ Imported #{po_count} purchase orders"
puts ""

# Create Project
project = Project.find_or_create_by!(name: "Malbon Street Master Schedule") do |p|
  p.project_code = "MALBON-001"
  p.construction = construction
  p.project_manager = user
  p.start_date = Date.current
  p.status = 'planning'
end
puts "✓ Created project: #{project.name}"
puts ""

# Generate Schedule
puts "🚀 Generating schedule..."
generator = Schedule::GeneratorService.new(project)

if generator.generate!
  project.reload

  puts ""
  puts "✅ SUCCESS!"
  puts ""
  puts "  Tasks: #{project.project_tasks.count}"
  puts "  Dependencies: #{TaskDependency.where(successor_task_id: project.project_tasks.select(:id)).count}"
  puts "  Tasks with POs: #{project.project_tasks.where.not(purchase_order_id: nil).count}"
  puts ""

  latest_task = project.project_tasks.order(:planned_end_date).last
  if latest_task
    days = (latest_task.planned_end_date - project.start_date).to_i
    weeks = (days / 7.0).round(1)
    months = (weeks / 4.3).round(1)

    puts "  📅 Timeline:"
    puts "    Start: #{project.start_date}"
    puts "    End: #{latest_task.planned_end_date}"
    puts "    Duration: #{days} days (#{weeks} weeks / #{months} months)"
  end
  puts ""
  puts "✅ Malbon Street project ready for exploration!"
else
  puts ""
  puts "❌ Schedule generation failed:"
  puts "  Errors: #{generator.errors.join(', ')}"
end
