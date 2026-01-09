# Delete category C
cat_c = PlanCategory.find_by(code: "C")
if cat_c
  count = cat_c.plan_types.count
  cat_c.plan_types.destroy_all
  cat_c.destroy
  puts "Deleted category C with #{count} plan types"
end

# Define all standard plan types
plan_types = [
  { code: "01", name: "PERSPECTIVE" },
  { code: "02", name: "SITE PLAN" },
  { code: "02a", name: "SURVEY PLAN" },
  { code: "03", name: "GROUND FLOOR PLAN" },
  { code: "03a", name: "FIRST FLOOR PLAN" },
  { code: "04", name: "ELEVATION 1" },
  { code: "04a", name: "ELEVATION 2" },
  { code: "05", name: "ELECTRICAL" },
  { code: "06", name: "LANDSCAPING PLAN" },
  { code: "07", name: "SLAB PLAN" },
  { code: "07a", name: "SLAB 3D" },
  { code: "08", name: "EXT CONCRETE PLAN" },
  { code: "09", name: "ROOF PLAN" },
  { code: "10", name: "DRAINAGE PLAN" },
  { code: "11", name: "ROOM AREAS" },
  { code: "12", name: "AIRCON" },
  { code: "13", name: "INSULATION" },
  { code: "14", name: "BRACING" },
  { code: "14a", name: "BRACING DETAILS" },
  { code: "15", name: "COMPLIANCE PLAN" },
  { code: "16", name: "ACCESS TO DWELLING" },
  { code: "17", name: "EMERGENCY EVAC PLAN" },
  { code: "18", name: "NDIS NOTES" },
  { code: "101", name: "KIT - CABINETRY DETAIL 1" },
  { code: "102", name: "LDY - CABINETRY DETAIL 2" },
  { code: "103", name: "BATH - CABINETRY DETAIL 3" },
  { code: "104", name: "ENS - CABINETRY DETAIL 4" },
  { code: "105", name: "WC - CABINETRY DETAIL 5" },
  { code: "106", name: "PWDR - CABINETRY DETAIL 6" }
]

# Add all types to each remaining category
PlanCategory.all.each do |category|
  puts "Adding types to #{category.code} - #{category.name}"
  plan_types.each_with_index do |pt, idx|
    existing = category.plan_types.find_by(code: pt[:code])
    unless existing
      category.plan_types.create!(code: pt[:code], name: pt[:name], sequence_order: idx, is_active: true)
    end
  end
  puts "  Total: #{category.plan_types.count} types"
end

puts ""
puts "Final summary:"
PlanCategory.order(:code).each { |c| puts "  #{c.code} - #{c.name}: #{c.plan_types.count} types" }
