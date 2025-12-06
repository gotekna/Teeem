# NDIS Construction Task Templates - Complete 154 Tasks with Dependencies
# Based on UpHomes NDIS Template Analysis
# Dependencies are stored as predecessor task sequence numbers

puts "🏗️  Seeding NDIS Task Templates (154 tasks)..."

# Clear existing templates if needed
# TaskTemplate.destroy_all if TaskTemplate.count > 0

NDIS_TASKS = [
  # Phase 1: Contract & Finance (Tasks 1-5)
  { seq: 1, name: "CREATE - Contract", type: "CREATE", category: "ADMIN", duration: 1, deps: [] },
  { seq: 2, name: "DO - Load Invoices into XERO", type: "DO", category: "ADMIN", duration: 1, deps: [ 1 ] },
  { seq: 3, name: "GET - Finance Approval", type: "GET", category: "ADMIN", duration: 3, deps: [ 1 ] },
  { seq: 4, name: "CLAIM - DEPOSIT", type: "CLAIM", category: "ADMIN", duration: 1, deps: [ 3 ] },
  { seq: 5, name: "ORDER - Soil Test and Wind Rating & Slab Design", type: "ORDER", category: "ADMIN", duration: 5, deps: [ 4 ] },

  # Phase 2: Design & Approvals (Tasks 6-15)
  { seq: 6, name: "ORDER - Contour Survey Plan", type: "ORDER", category: "SURVEYOR", duration: 3, deps: [ 4 ] },
  { seq: 7, name: "DO - Working Drawings", type: "DO", category: "ADMIN", duration: 5, deps: [ 4, 6 ] },
  { seq: 8, name: "DO - Plumbing Approval", type: "DO", category: "ADMIN", duration: 5, deps: [ 3, 4 ] },
  { seq: 9, name: "DO - QLeave", type: "DO", category: "ADMIN", duration: 5, deps: [ 3, 4 ] },
  { seq: 10, name: "DO - Hydraulics Design", type: "DO", category: "ADMIN", duration: 3, deps: [ 3, 4 ] },
  { seq: 11, name: "DO - Energy Efficiency", type: "DO", category: "ADMIN", duration: 3, deps: [ 3, 4 ] },
  { seq: 12, name: "CHECK - Land Settlement", type: "CHECK", category: "ADMIN", duration: 30, deps: [ 3, 4 ] },
  { seq: 13, name: "DO - Covenant Approval (if required)", type: "DO", category: "ADMIN", duration: 5, deps: [ 7 ] },
  { seq: 14, name: "DO - Certification", type: "DO", category: "ADMIN", duration: 7, deps: [ 8, 9, 10, 11 ] },
  { seq: 15, name: "DO - Driveway Application", type: "DO", category: "ADMIN", duration: 3, deps: [ 14 ] },

  # Phase 3: Material Orders (Tasks 16-25)
  { seq: 16, name: "ORDER - Trusses", type: "ORDER", category: "MATERIALS", duration: 14, deps: [ 12, 14 ] },
  { seq: 17, name: "ORDER - Window Actuators", type: "ORDER", category: "MATERIALS", duration: 21, deps: [ 12, 14 ] },
  { seq: 18, name: "ORDER - Kitchen Parts", type: "ORDER", category: "MATERIALS", duration: 28, deps: [ 12, 14 ] },
  { seq: 19, name: "ORDER - Door Automation", type: "ORDER", category: "MATERIALS", duration: 21, deps: [ 12, 14 ] },
  { seq: 20, name: "ORDER - Plumbing Items", type: "ORDER", category: "MATERIALS", duration: 14, deps: [ 12, 14 ] },
  { seq: 21, name: "ORDER - Frame", type: "ORDER", category: "MATERIALS", duration: 14, deps: [ 12, 14 ] },
  { seq: 22, name: "ORDER - Roof", type: "ORDER", category: "MATERIALS", duration: 14, deps: [ 12, 14 ] },
  { seq: 23, name: "ORDER - EXT Doors", type: "ORDER", category: "MATERIALS", duration: 21, deps: [ 12, 14 ] },
  { seq: 24, name: "ORDER - Surveyor", type: "ORDER", category: "SURVEYOR", duration: 2, deps: [ 12, 14 ] },
  { seq: 25, name: "ORDER - Windows", type: "ORDER", category: "MATERIALS", duration: 21, deps: [ 12, 14 ] },

  # Phase 4: Site Preparation (Tasks 26-32)
  { seq: 26, name: "Req Site Cut", type: "DO", category: "SITE_PREP", duration: 2, deps: [ 12, 14 ] },
  { seq: 27, name: "Req Surveyor to Setout Wafflepod", type: "DO", category: "SURVEYOR", duration: 1, deps: [ 26 ] },
  { seq: 28, name: "Req Drainer for Drains Wafflepod", type: "DO", category: "PLUMBER", duration: 2, deps: [ 27 ] },
  { seq: 29, name: "Req Electrician Underground (INC NBN)", type: "DO", category: "ELECTRICAL", duration: 2, deps: [ 28 ] },
  { seq: 30, name: "Req Power To Site", type: "DO", category: "ELECTRICAL", duration: 1, deps: [ 29 ] },
  { seq: 31, name: "Req Concreter For Complete Slab", type: "DO", category: "CONCRETE", duration: 5, deps: [ 28, 29, 30 ] },
  { seq: 32, name: "Req Termite Protection Penetrations", type: "DO", category: "TERMITE", duration: 1, deps: [ 31 ] },

  # Phase 5: Slab Completion (Tasks 33-38)
  { seq: 33, name: "PHOTO - Slab", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 31 ] },
  { seq: 34, name: "Req Waterproof Slab Edge", type: "DO", category: "WATERPROOF", duration: 1, deps: [ 31 ] },
  { seq: 35, name: "CLAIM - Slab", type: "CLAIM", category: "ADMIN", duration: 1, deps: [ 31 ] },
  { seq: 36, name: "CERTIFICATE - Surveyor", type: "CERTIFICATE", category: "ADMIN", duration: 10, deps: [ 27 ] },
  { seq: 37, name: "CERTIFICATE - Engineer Slab", type: "CERTIFICATE", category: "ADMIN", duration: 10, deps: [ 31 ] },
  { seq: 38, name: "Req Frame Hardware", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 31 ] },

  # Phase 6: Frame Construction (Tasks 39-50)
  { seq: 39, name: "Req Frame Material Ground Floor", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 31 ] },
  { seq: 40, name: "Req Carpenter Ground Floor", type: "DO", category: "CARPENTER", duration: 7, deps: [ 31 ] },
  { seq: 41, name: "Req Termite Perimeter", type: "DO", category: "TERMITE", duration: 1, deps: [ 40 ] },
  { seq: 42, name: "Req Roof Trusses", type: "DO", category: "ROOFING", duration: 1, deps: [ 40 ] },
  { seq: 43, name: "Req Crane Roof Trusses", type: "DO", category: "EQUIPMENT", duration: 1, deps: [ 42 ] },
  { seq: 44, name: "Req Steel Posts", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 42 ] },
  { seq: 45, name: "PHOTO - Frame", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 40 ] },
  { seq: 46, name: "Do Frame Inspection", type: "CHECK", category: "ADMIN", duration: 1, deps: [ 40 ] },
  { seq: 47, name: "Req Partition Wall", type: "DO", category: "CARPENTER", duration: 2, deps: [ 40 ] },
  { seq: 48, name: "CERTIFICATE - Engineer Frame INC Hoist", type: "CERTIFICATE", category: "ADMIN", duration: 5, deps: [ 45 ] },
  { seq: 49, name: "CERTIFICATE - Termite", type: "CERTIFICATE", category: "ADMIN", duration: 5, deps: [ 41 ] },
  { seq: 50, name: "CLAIM - Frame", type: "CLAIM", category: "ADMIN", duration: 1, deps: [ 40, 46 ] },

  # Phase 7: Roof & External (Tasks 51-62)
  { seq: 51, name: "CERTIFICATE - Roof Trusses", type: "CERTIFICATE", category: "ADMIN", duration: 5, deps: [ 42 ] },
  { seq: 52, name: "Req Fascia and Gutter and Colorbond Roof", type: "DO", category: "ROOFING", duration: 5, deps: [ 40, 44 ] },
  { seq: 53, name: "Req External Doors", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 52 ] },
  { seq: 54, name: "Req Windows", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 52 ] },
  { seq: 55, name: "Req External Door Handle Locks", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 53 ] },
  { seq: 56, name: "Req Carpenter Install Windows/Doors", type: "DO", category: "CARPENTER", duration: 3, deps: [ 40, 44, 54 ] },
  { seq: 57, name: "Req Carpenter Straighten Frame", type: "DO", category: "CARPENTER", duration: 2, deps: [ 56 ] },
  { seq: 58, name: "Req Mixer Bodies For Plumber Rough In", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 65 ] },
  { seq: 59, name: "FIT - Window Actuators", type: "FIT", category: "EQUIPMENT", duration: 1, deps: [ 54, 56 ] },
  { seq: 60, name: "Req Wall Sisilation Ground Floor", type: "DO", category: "MATERIALS", duration: 1, deps: [ 56 ] },
  { seq: 61, name: "Req Measure Garage Doors", type: "DO", category: "MATERIALS", duration: 1, deps: [ 56 ] },
  { seq: 62, name: "Req Rough In Solar Panels", type: "DO", category: "ELECTRICAL", duration: 2, deps: [ 52 ] },

  # Phase 8: Services Rough-In (Tasks 63-75)
  { seq: 63, name: "Req Air Conditioning Rough In", type: "DO", category: "AIRCON", duration: 2, deps: [ 52 ] },
  { seq: 64, name: "Req Electrician - Prewire", type: "DO", category: "ELECTRICAL", duration: 3, deps: [ 52 ] },
  { seq: 65, name: "Req Plumber Rough In", type: "DO", category: "PLUMBER", duration: 3, deps: [ 52 ] },
  { seq: 66, name: "Req Soffit Hardware and Cladding", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 52 ] },
  { seq: 67, name: "Req Fire Rough In", type: "DO", category: "ELECTRICAL", duration: 1, deps: [ 52 ] },
  { seq: 68, name: "Req Carpenter Soffits Ground Floor", type: "DO", category: "CARPENTER", duration: 2, deps: [ 52, 66 ] },
  { seq: 69, name: "Req Install Ply to Bathrooms", type: "DO", category: "CARPENTER", duration: 1, deps: [ 65 ] },
  { seq: 70, name: "Do Plumbing Rough-In Inspection", type: "CHECK", category: "ADMIN", duration: 1, deps: [ 65 ] },
  { seq: 71, name: "Req Carpenter Cladding", type: "DO", category: "CARPENTER", duration: 3, deps: [ 68 ] },
  { seq: 72, name: "Do Inspection NDIS", type: "CHECK", category: "ADMIN", duration: 1, deps: [ 69 ] },
  { seq: 73, name: "PHOTO - Ply Bathrooms, Bedroom Crane Supports", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 69 ] },
  { seq: 74, name: "CERTIFICATE - Windows", type: "CERTIFICATE", category: "ADMIN", duration: 5, deps: [ 54 ] },
  { seq: 75, name: "PHOTO - Enclosed", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 71 ] },

  # Phase 9: Insulation & Plaster (Tasks 76-84)
  { seq: 76, name: "Req Down Pipes Ground Floor", type: "DO", category: "MATERIALS", duration: 1, deps: [ 71 ] },
  { seq: 77, name: "CLAIM - Enclosed", type: "CLAIM", category: "ADMIN", duration: 1, deps: [ 71, 75 ] },
  { seq: 78, name: "Req Ceiling & Wall Insulation", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 65, 64, 67, 63, 62 ] },
  { seq: 79, name: "Req Plaster Board", type: "DO", category: "PLASTERER", duration: 5, deps: [ 70, 63, 64, 65, 78 ] },
  { seq: 80, name: "Req Internal Fixout", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 79 ] },
  { seq: 81, name: "Req Carpenter Fixout", type: "DO", category: "CARPENTER", duration: 3, deps: [ 79 ] },
  { seq: 82, name: "Req Garage Doors", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 79 ] },
  { seq: 83, name: "SPO - Electrician - Cutouts", type: "DO", category: "ELECTRICAL", duration: 1, deps: [ 79 ] },
  { seq: 84, name: "Req Internal Door Handles", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 80 ] },

  # Phase 10: Kitchen & Wet Areas (Tasks 85-94)
  { seq: 85, name: "FIT - Auto Door Openers", type: "FIT", category: "EQUIPMENT", duration: 1, deps: [ 80 ] },
  { seq: 86, name: "Req Kitchen", type: "DO", category: "KITCHEN", duration: 3, deps: [ 80 ] },
  { seq: 87, name: "Req Water Proofer", type: "DO", category: "WATERPROOF", duration: 2, deps: [ 80 ] },
  { seq: 88, name: "Req Tiles", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 87 ] },
  { seq: 89, name: "Req Tiler", type: "DO", category: "TILER", duration: 5, deps: [ 86, 87 ] },
  { seq: 90, name: "SPO - Plaster Fit Cornice", type: "DO", category: "PLASTERER", duration: 2, deps: [ 86 ] },
  { seq: 91, name: "CERTIFICATE - Waterproofer", type: "CERTIFICATE", category: "ADMIN", duration: 5, deps: [ 87 ] },
  { seq: 92, name: "Req Painter Internal House", type: "DO", category: "PAINTER", duration: 5, deps: [ 89 ] },
  { seq: 93, name: "Measure Shower Screens Book Fitting", type: "DO", category: "ADMIN", duration: 1, deps: [ 89 ] },
  { seq: 94, name: "Req Pre Paint (Including Sanding)", type: "DO", category: "PAINTER", duration: 2, deps: [ 92 ] },

  # Phase 11: Painting & External (Tasks 95-103)
  { seq: 95, name: "PHOTO - Fixing", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 88, 92 ] },
  { seq: 96, name: "Req Painter External House", type: "DO", category: "PAINTER", duration: 5, deps: [ 92, 71, 76 ] },
  { seq: 97, name: "CLAIM - Fixing", type: "CLAIM", category: "ADMIN", duration: 1, deps: [ 89, 92, 96 ] },
  { seq: 98, name: "Req Driveway Kerb Cut Out", type: "DO", category: "CONCRETE", duration: 1, deps: [ 103 ] },
  { seq: 99, name: "FIT - Drains to Front of Doors", type: "DO", category: "PLUMBER", duration: 1, deps: [ 103 ] },
  { seq: 100, name: "Req Driveway Steel Reo", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 103 ] },
  { seq: 101, name: "Req Driveway Concretor", type: "DO", category: "CONCRETE", duration: 2, deps: [ 76, 89 ] },
  { seq: 102, name: "PHOTO - Driveway", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 101 ] },
  { seq: 103, name: "Req Retaining Wall", type: "DO", category: "CONCRETE", duration: 2, deps: [ 101 ] },

  # Phase 12: Landscaping & External (Tasks 104-110)
  { seq: 104, name: "Req Fence", type: "DO", category: "FENCING", duration: 2, deps: [ 106, 101 ] },
  { seq: 105, name: "Req Landscaping", type: "DO", category: "LANDSCAPING", duration: 3, deps: [ 107 ] },
  { seq: 106, name: "PHOTO - Fence and Landscaping", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 107, 108 ] },
  { seq: 107, name: "Req Hot Water System", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 118 ] },
  { seq: 108, name: "Req Plumber Fitoff Gear", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 118 ] },
  { seq: 109, name: "Req Fire System Fitoff", type: "DO", category: "ELECTRICAL", duration: 1, deps: [ 92, 89 ] },
  { seq: 110, name: "Req Electrical Items", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 124 ] },

  # Phase 13: Final Fitoff (Tasks 111-130)
  { seq: 111, name: "Req Vinyl Sliders", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 92, 89 ] },
  { seq: 112, name: "Req Window Coverings", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 92, 89 ] },
  { seq: 113, name: "Req Carpenter For Final Fitoff", type: "DO", category: "CARPENTER", duration: 2, deps: [ 89, 92 ] },
  { seq: 114, name: "Req Plumber - Fit Off", type: "DO", category: "PLUMBER", duration: 2, deps: [ 89, 92 ] },
  { seq: 115, name: "Req Shower Screens", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 89, 92 ] },
  { seq: 116, name: "Req SAT System", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 124 ] },
  { seq: 117, name: "CERTIFICATE - Fire Alarms", type: "CERTIFICATE", category: "ADMIN", duration: 1, deps: [ 109 ] },
  { seq: 118, name: "CERTIFICATE - Shower Screens", type: "CERTIFICATE", category: "ADMIN", duration: 1, deps: [ 115 ] },
  { seq: 119, name: "Do Finishing Touches", type: "DO", category: "ADMIN", duration: 1, deps: [ 113 ] },
  { seq: 120, name: "Req Electrician - Fit Off", type: "DO", category: "ELECTRICAL", duration: 2, deps: [ 89, 92, 113 ] },
  { seq: 121, name: "Do Plumbing Final Inspection", type: "CHECK", category: "ADMIN", duration: 1, deps: [ 114 ] },
  { seq: 122, name: "Req Gapping To Skirting", type: "DO", category: "PAINTER", duration: 1, deps: [ 114, 113 ] },
  { seq: 123, name: "Req Air Conditioning Fit Off", type: "DO", category: "AIRCON", duration: 1, deps: [ 124 ] },
  { seq: 124, name: "GET - All Forms for Final Inspection", type: "GET", category: "ADMIN", duration: 3, deps: [ 142 ] },
  { seq: 125, name: "DO - Get Hot Water Rebate", type: "DO", category: "ADMIN", duration: 1, deps: [ 115 ] },
  { seq: 126, name: "Req Full Turn Key Package", type: "DO", category: "ADMIN", duration: 1, deps: [ 124, 114 ] },
  { seq: 127, name: "Req Painter Touch Ups", type: "DO", category: "PAINTER", duration: 1, deps: [ 114, 124, 111 ] },
  { seq: 128, name: "Req Solar Panel Commisions", type: "DO", category: "ELECTRICAL", duration: 1, deps: [ 124 ] },
  { seq: 129, name: "CERTIFICATE - Electrician", type: "CERTIFICATE", category: "ADMIN", duration: 1, deps: [ 124 ] },
  { seq: 130, name: "Req Ceiling Insulation", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 124, 132 ] },

  # Phase 14: Final Completion (Tasks 131-154)
  { seq: 131, name: "Req Vinyl Floor", type: "ORDER", category: "MATERIALS", duration: 1, deps: [ 130 ] },
  { seq: 132, name: "Req Window Handover Service", type: "DO", category: "ADMIN", duration: 1, deps: [ 124 ] },
  { seq: 133, name: "SPO - Insulation Spread Ceiling", type: "DO", category: "MATERIALS", duration: 1, deps: [ 124, 132 ] },
  { seq: 134, name: "Do - Put Termite Sticker", type: "DO", category: "ADMIN", duration: 1, deps: [ 142 ] },
  { seq: 135, name: "Req Builders Clean", type: "DO", category: "CLEANING", duration: 2, deps: [ 124, 132, 133, 123 ] },
  { seq: 136, name: "CERTIFICATE - Ceiling Insulation", type: "CERTIFICATE", category: "ADMIN", duration: 1, deps: [ 134 ] },
  { seq: 137, name: "PHOTO - Practical Completion", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 139 ] },
  { seq: 138, name: "Do Council Final Inspection", type: "CHECK", category: "ADMIN", duration: 1, deps: [ 139, 142 ] },
  { seq: 139, name: "GET - Form 11/21 from Certifier", type: "GET", category: "ADMIN", duration: 1, deps: [ 135 ] },
  { seq: 140, name: "CREATE - Builder Confirmation", type: "CREATE", category: "ADMIN", duration: 1, deps: [ 142 ] },
  { seq: 141, name: "GET - Engineer For Future Ceiling", type: "GET", category: "ADMIN", duration: 1, deps: [ 142 ] },
  { seq: 142, name: "GET - SDA Site Density Report", type: "GET", category: "ADMIN", duration: 3, deps: [ 120 ] },
  { seq: 143, name: "CREATE - Evacuation Plan", type: "CREATE", category: "ADMIN", duration: 1, deps: [ 142 ] },
  { seq: 144, name: "CLAIM - Practical Completion", type: "CLAIM", category: "ADMIN", duration: 1, deps: [ 142 ] },
  { seq: 145, name: "DO - NDIS Final Inspection", type: "CHECK", category: "ADMIN", duration: 1, deps: [ 142, 144, 147 ] },
  { seq: 146, name: "DO - Final Payment & Handover", type: "DO", category: "ADMIN", duration: 1, deps: [ 142, 148 ] },
  { seq: 147, name: "CERTIFICATE - NDIS Compliance", type: "CERTIFICATE", category: "ADMIN", duration: 5, deps: [ 142 ] },
  { seq: 148, name: "GET - Final Council Approval", type: "GET", category: "ADMIN", duration: 3, deps: [ 142 ] },
  { seq: 149, name: "CREATE - Maintenance Documentation", type: "CREATE", category: "ADMIN", duration: 2, deps: [ 142 ] },
  { seq: 150, name: "DO - Handover Documentation Pack", type: "DO", category: "ADMIN", duration: 1, deps: [ 149 ] },
  { seq: 151, name: "PHOTO - Final Property Photos", type: "PHOTO", category: "ADMIN", duration: 1, deps: [ 135 ] },
  { seq: 152, name: "CREATE - Defects List", type: "CREATE", category: "ADMIN", duration: 1, deps: [ 138 ] },
  { seq: 153, name: "DO - Rectify Defects", type: "DO", category: "ADMIN", duration: 5, deps: [ 152 ] },
  { seq: 154, name: "CLAIM - Final Retention Release", type: "CLAIM", category: "ADMIN", duration: 1, deps: [ 153 ] }
]

created_count = 0
skipped_count = 0

NDIS_TASKS.each do |task_data|
  # Check if task already exists
  if TaskTemplate.exists?(sequence_order: task_data[:seq])
    skipped_count += 1
    next
  end

  TaskTemplate.create!(
    name: task_data[:name],
    task_type: task_data[:type],
    category: task_data[:category],
    default_duration_days: task_data[:duration],
    sequence_order: task_data[:seq],
    predecessor_template_codes: task_data[:deps],
    description: "NDIS standard task - #{task_data[:name]}"
  )

  created_count += 1
  print "."
end

puts "\n✓ Created #{created_count} task templates"
puts "  Skipped #{skipped_count} existing templates"
puts "\n📊 Task Template Summary:"
puts "  Total Templates: #{TaskTemplate.count}"

# Show breakdown by category
categories = TaskTemplate.group(:category).count
puts "\n📋 Tasks by Category:"
categories.sort.each do |category, count|
  puts "  #{category}: #{count} tasks"
end

# Show breakdown by type
types = TaskTemplate.group(:task_type).count
puts "\n🔧 Tasks by Type:"
types.sort.each do |type, count|
  puts "  #{type}: #{count} tasks"
end

puts "\n✅ NDIS Task Templates seeded successfully!"
puts "Ready to generate construction schedules 🚀"
