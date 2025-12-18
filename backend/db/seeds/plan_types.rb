# Seed plan categories and types (SSoT for construction drawings)

puts "Seeding plan categories and types..."

# Create revision formats first
RevisionFormat.seed_defaults!
puts "  Created revision formats"

# Plan Categories
categories = {
  'A' => { name: 'Drawings', sequence_order: 1 },
  'B' => { name: 'Certification Drawings', sequence_order: 2 },
  'C' => { name: 'Cabinets', sequence_order: 3 }
}

categories.each do |code, attrs|
  PlanCategory.find_or_create_by!(code: code) do |cat|
    cat.name = attrs[:name]
    cat.sequence_order = attrs[:sequence_order]
  end
end
puts "  Created #{PlanCategory.count} plan categories"

# Plan Types
plan_types = [
  # Drawings (A)
  { category_code: 'A', code: '01', name: 'PERSPECTIVE', sequence_order: 1 },
  { category_code: 'A', code: '02', name: 'SITE PLAN', sequence_order: 2 },
  { category_code: 'A', code: '02a', name: 'SURVEY PLAN', sequence_order: 3 },
  { category_code: 'A', code: '03', name: 'GROUND FLOOR PLAN', sequence_order: 4 },
  { category_code: 'A', code: '03a', name: 'FIRST FLOOR PLAN', sequence_order: 5 },
  { category_code: 'A', code: '04', name: 'ELEVATION 1', sequence_order: 6 },
  { category_code: 'A', code: '04a', name: 'ELEVATION 2', sequence_order: 7 },
  { category_code: 'A', code: '05', name: 'ELECTRICAL', sequence_order: 8 },
  { category_code: 'A', code: '06', name: 'LANDSCAPING PLAN', sequence_order: 9 },

  # Certification Drawings (B)
  { category_code: 'B', code: '07', name: 'SLAB PLAN', sequence_order: 10 },
  { category_code: 'B', code: '07a', name: 'SLAB 3D', sequence_order: 11 },
  { category_code: 'B', code: '08', name: 'EXT CONCRETE PLAN', sequence_order: 12 },
  { category_code: 'B', code: '09', name: 'ROOF PLAN', sequence_order: 13 },
  { category_code: 'B', code: '10', name: 'DRAINAGE PLAN', sequence_order: 14 },
  { category_code: 'B', code: '11', name: 'ROOM AREAS', sequence_order: 15 },
  { category_code: 'B', code: '12', name: 'AIRCON', sequence_order: 16 },
  { category_code: 'B', code: '13', name: 'INSULATION', sequence_order: 17 },
  { category_code: 'B', code: '14', name: 'BRACING', sequence_order: 18 },
  { category_code: 'B', code: '14a', name: 'BRACING DETAILS', sequence_order: 19 },
  { category_code: 'B', code: '15', name: 'COMPLIANCE PLAN', sequence_order: 20 },
  { category_code: 'B', code: '16', name: 'ACCESS TO DWELLING', sequence_order: 21 },
  { category_code: 'B', code: '17', name: 'EMERGENCY EVAC PLAN', sequence_order: 22 },
  { category_code: 'B', code: '18', name: 'NDIS NOTES', sequence_order: 23 },

  # Cabinets (C)
  { category_code: 'C', code: '101', name: 'KIT - CABINETRY DETAIL 1', sequence_order: 100, notes: 'For extra needed: 101a, 101b, etc' },
  { category_code: 'C', code: '102', name: 'LDY - CABINETRY DETAIL 2', sequence_order: 101, notes: 'For extra needed: 102a, 102b, etc' },
  { category_code: 'C', code: '103', name: 'BATH - CABINETRY DETAIL 3', sequence_order: 102, notes: 'For extra needed: 103a, 103b, etc' },
  { category_code: 'C', code: '104', name: 'ENS - CABINETRY DETAIL 4', sequence_order: 103, notes: 'For extra needed: 104a, 104b, etc' },
  { category_code: 'C', code: '105', name: 'WC - CABINETRY DETAIL 5', sequence_order: 104, notes: 'For extra needed: 105a, 105b, etc' },
  { category_code: 'C', code: '106', name: 'PWDR - CABINETRY DETAIL 6', sequence_order: 105, notes: 'For extra needed: 106a, 106b, etc' }
]

plan_types.each do |attrs|
  category = PlanCategory.find_by!(code: attrs[:category_code])
  PlanType.find_or_create_by!(plan_category: category, code: attrs[:code]) do |pt|
    pt.name = attrs[:name]
    pt.sequence_order = attrs[:sequence_order]
    pt.notes = attrs[:notes]
  end
end

puts "  Created #{PlanType.count} plan types"
puts "Done seeding plan categories and types!"
