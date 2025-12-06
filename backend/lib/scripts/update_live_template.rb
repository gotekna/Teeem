# Update the live folder template to Tekna Standard Residential structure
template = FolderTemplate.find_by(is_system_default: true, is_active: true)
puts "Updating template: #{template.name}"

# Clear all existing items
template.folder_template_items.destroy_all
puts "Cleared existing items"

# New structure
structure = [
  { name: "01 Sales", order: 1, children: [] },
  { name: "02 PreCon", order: 2, children: [
    { name: "Revit-DWG", order: 1 },
    { name: "Land Info", order: 2 },
    { name: "Estimation", order: 3 },
    { name: "Contracts", order: 4 },
    { name: "Colour Selection", order: 5 }
  ] },
  { name: "03 Certification", order: 3, children: [
    { name: "Council", order: 1 },
    { name: "NDIS", order: 2 },
    { name: "Plumbing", order: 3 },
    { name: "Energy Efficiency", order: 4 },
    { name: "Final Approval", order: 5 }
  ] },
  { name: "04 Plans", order: 4, children: [
    { name: "Sales Plans", order: 1 },
    { name: "Certified Plans", order: 2 },
    { name: "Working Drawings", order: 3 }
  ] },
  { name: "05 Site", order: 5, children: [] },
  { name: "06 Photo", order: 6, children: [
    { name: "01 SITE", order: 1 },
    { name: "02 SLAB", order: 2 },
    { name: "03 FRAME", order: 3 },
    { name: "04 ENCLOSED", order: 4 },
    { name: "05 FIXING", order: 5 },
    { name: "06 Practical Completion", order: 6 },
    { name: "07 Supervisor Photos", order: 7 }
  ] },
  { name: "07 Final Approval", order: 7, children: [
    { name: "Final Docs Required", order: 1 },
    { name: "Form 21", order: 2 },
    { name: "NDIS", order: 3 },
    { name: "Plumbing", order: 4 }
  ] }
]

# Create items
structure.each do |folder|
  parent = template.folder_template_items.create!(
    name: folder[:name],
    level: 1,
    order: folder[:order],
    description: folder[:name]
  )
  puts "Created: #{folder[:name]}"

  folder[:children].each do |child|
    template.folder_template_items.create!(
      name: child[:name],
      level: 2,
      order: child[:order],
      parent_id: parent.id,
      description: child[:name]
    )
    puts "  - #{child[:name]}"
  end
end

# Update template name
template.update!(name: "Tekna Standard Residential")
puts ""
puts "Template updated to: #{template.name}"
