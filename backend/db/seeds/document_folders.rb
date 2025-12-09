# Document Folders Seed Data
# SSoT for folder/tab configuration across the application

puts "Seeding Document Folders..."

folders = [
  {
    name: "COMPANY",
    order_position: 1,
    entity_types: ["trading_company", "trustee_company"],
    description: "Company setup, structure, shareholding"
  },
  {
    name: "XERO",
    order_position: 2,
    entity_types: ["trading_company", "trust"],
    description: "Xero integration, invoices, accounting"
  },
  {
    name: "BANK",
    order_position: 3,
    entity_types: ["trading_company", "trust"],
    description: "Bank accounts, statements, transactions"
  },
  {
    name: "ATO",
    order_position: 4,
    entity_types: ["trading_company", "trust"],
    description: "Tax returns, BAS, IAS, ATO correspondence"
  },
  {
    name: "ASIC",
    order_position: 5,
    entity_types: ["trading_company", "trustee_company"],
    description: "ASIC forms, annual reviews, company updates"
  },
  {
    name: "PAYROLL",
    order_position: 6,
    entity_types: ["trading_company"],
    description: "Payroll reports, timesheets, employee records"
  },
  {
    name: "SUPERANNUATION",
    order_position: 7,
    entity_types: ["trading_company"],
    description: "Super contributions, statements, compliance"
  },
  {
    name: "INSURANCE",
    order_position: 8,
    entity_types: ["trading_company", "trust"],
    description: "Insurance policies, claims, renewals"
  },
  {
    name: "CONTRACTS",
    order_position: 9,
    entity_types: ["trading_company"],
    description: "Client contracts, agreements, terms"
  },
  {
    name: "MINUTES",
    order_position: 10,
    entity_types: ["trading_company", "trustee_company"],
    description: "Board minutes, resolutions, AGM notes"
  },
  {
    name: "COMPLIANCE",
    order_position: 11,
    entity_types: ["trading_company"],
    description: "Compliance certificates, audits, regulatory"
  },
  {
    name: "ADVICE",
    order_position: 12,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Professional advice, legal opinions, consultant reports"
  },
  {
    name: "TRUST",
    order_position: 13,
    entity_types: ["trust"],
    description: "Trust deeds, variations, beneficiary details"
  },
  {
    name: "GENERAL",
    order_position: 14,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Miscellaneous documents not fitting other categories"
  }
]

folders.each do |folder_data|
  folder = DocumentFolder.find_or_initialize_by(name: folder_data[:name])
  folder.assign_attributes(folder_data)
  if folder.save
    puts "  ✓ #{folder.name} (#{folder.entity_types.join(', ')})"
  else
    puts "  ✗ Failed to create #{folder_data[:name]}: #{folder.errors.full_messages.join(', ')}"
  end
end

puts "Document Folders seeding complete!"
puts "  Trading Company folders: #{DocumentFolder.for_entity_type('trading_company').count}"
puts "  Trust folders: #{DocumentFolder.for_entity_type('trust').count}"
puts "  Trustee Company folders: #{DocumentFolder.for_entity_type('trustee_company').count}"
