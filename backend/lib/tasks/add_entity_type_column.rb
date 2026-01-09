# Add entity_type column to Companies foundation registry

# SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
companies_foundation = Foundation.find_by(slug: "corporate_companies")
unless companies_foundation
  puts "⚠️ Foundation 'corporate_companies' not found - skipping"
  return
end

Column.create!(
  foundation_id: companies_foundation.id,
  name: "Entity Type",
  column_name: "entity_type",
  column_type: "choice",
  position: 34,
  required: false,
  available_choices: [ "company", "trust", "person" ]
)

puts "✓ Added Entity Type column to Companies foundation (slug: corporate_companies, id: #{companies_foundation.id})"
puts "  Choices: company, trust, person"
puts "  Default: company"
