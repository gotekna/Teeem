# JobDesigns Seed Data
puts "Seeding JobDesigns library..."

designs_data = [
  {
    name: "The Hampton 250",
    size: 250.0,
    frontage_required: 12.5,
    description: "Classic family home with 4 bedrooms, 2 bathrooms. Open plan living with modern kitchen.",
    floor_plan_url: nil,
    is_active: true
  },
  {
    name: "The Madison 280",
    size: 280.0,
    frontage_required: 14.0,
    description: "Spacious 4 bedroom home with master suite, media room, and generous outdoor alfresco.",
    floor_plan_url: nil,
    is_active: true
  },
  {
    name: "The Riverside 320",
    size: 320.0,
    frontage_required: 16.0,
    description: "Executive home with 5 bedrooms, 3 bathrooms, home office, and large entertaining areas.",
    floor_plan_url: nil,
    is_active: true
  },
  {
    name: "The Coastal 210",
    size: 210.0,
    frontage_required: 11.0,
    description: "Compact yet functional 3 bedroom home perfect for narrow blocks. Light and airy design.",
    floor_plan_url: nil,
    is_active: true
  },
  {
    name: "The Parkview 380",
    size: 380.0,
    frontage_required: 18.0,
    description: "Luxury double-storey design with 5 bedrooms, 4 bathrooms, theatre room, and grand living spaces.",
    floor_plan_url: nil,
    is_active: true
  }
]

designs_data.each do |design_data|
  JobDesign.find_or_create_by!(name: design_data[:name]) do |design|
    design.assign_attributes(design_data)
  end
end

puts "Created #{JobDesign.count} designs"
puts "JobDesigns seed complete!"
