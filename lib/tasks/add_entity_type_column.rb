# Add entity_type column to Companies foundation registry

Column.create!(
  foundation_id: 353,
  name: "Entity Type",
  column_name: "entity_type",
  column_type: "choice",
  position: 34,
  required: false,
  available_choices: [ "company", "trust", "person" ]
)

puts "✓ Added Entity Type column to Companies foundation (ID: 353)"
puts "  Choices: company, trust, person"
puts "  Default: company"
