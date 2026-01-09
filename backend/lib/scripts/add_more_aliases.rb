# Add more aliases to catch the remaining 15 files
puts "=== ADDING MORE ALIASES ==="

# The 15 files and their classifications:
# 1. Lot 83 Westridge.pdf -> Plans (has "lot" + address)
# 2. 04_QBCC_Contract_*.pdf -> Contracts (has "qbcc" + "contract")
# 3. 05_Tekna_Specifications_*.pdf -> Colour Selection (has "specifications")
# 4. Lot_83_Westridge.pdf -> Plans
# 5. Summary.pdf -> Sales
# 6. 83 - STAGE TWO - REIQ Land Contract.pdf -> Contracts (has "reiq", "contract")
# 7. Amended Plans with Lot 83 High.pdf -> Plans (has "plans", "amended")
# 8. Q Leave.pdf -> Contracts (Q-Leave levy)
# 9. QBCC Notice of Cover*.pdf -> Contracts (has "qbcc", "notice", "cover")
# 10. Redland Council Explaining Situation.msg -> Council
# 11. APPROVED_Revised Architectural Plans.pdf -> Plans (has "plans", "approved")
# 12. APPROVED_Revised Engineering.pdf -> Engineering/DWG
# 13. Qleave.pdf -> Contracts
# 14. cora spec.pdf -> Colour Selection (has "spec")

updates = {
  # Plans - add more patterns
  "SPLAN" => [ "sales plan", "lot plan", "presentation plan", "westridge", "lot 83", "lot plan",
              "lot_", "revised plan", "amended plan", "architectural plan" ],

  # Contracts - add QBCC, Q-Leave patterns
  "JCON" => [ "job contract", "building contract", "qbcc contract", "qbcc_contract", "reiq contract",
             "land contract", "form 1", "form1", "building application", "engagement", "agreement",
             "qbcc", "q leave", "qleave", "q-leave", "notice of cover", "stage two" ],

  # Colour Selection - add more spec patterns
  "COLOR" => [ "colour selection", "color selection", "selections", "vanity", "sink", "tap", "mixer",
              "faucet", "subline", "blanco", "specsheet", "spec sheet", "userguide", "user guide",
              "userinstall", "product spec", "fixture spec", "appliance spec", "haier", "bosch",
              "specifications", "tekna_specifications", "cora spec", "cora" ],

  # Council - add Redland pattern
  "COUNCIL" => [ "council approval", "council permit", "referral agency", "minor change", "existing approval",
                "development approval", "concurrence", "car24", "decision notice", "driveway", "crossover",
                "redland council", "redland city" ],

  # Plans - certified (for approved plans)
  "CPLAN" => [ "certified plan", "certification plan", "approved plan", "approved_revised", "revised architectural" ],

  # Engineering/DWG - add engineering patterns
  "DWG" => [ "autocad drawing", "cad drawing", "engineering drawing", "truss", "design",
            "revised engineering", "structural", "engineering" ]

  # Sales
  # Need a new document type for summary/general sales docs
}

updates.each do |abbrev, new_aliases|
  dt = DocumentType.find_by(abbreviation: abbrev)
  if dt
    # Merge with existing aliases
    existing = dt.aliases || []
    merged = (existing + new_aliases).uniq
    dt.update!(aliases: merged)
    puts "Updated #{abbrev}: #{merged.length} aliases (added #{merged.length - existing.length} new)"
  else
    puts "NOT FOUND: #{abbrev}"
  end
end

# Create a SALES document type for summary docs
sales_type = DocumentType.find_or_initialize_by(abbreviation: "SALES")
sales_type.assign_attributes(
  name: "Sales Document",
  target_folder: "01 Sales",
  folder: "SALES",
  naming_format: "{CompanyCode} {JobCode} Sales {Description}",
  scope: "job",
  category: "general",
  aliases: [ "sales", "summary", "brief", "proposal", "quote request" ],
  file_extensions: [ ".pdf", ".docx" ],
  active: true
)
if sales_type.new_record?
  sales_type.save!
  puts "Created: SALES - Sales Document"
else
  sales_type.save!
  puts "Updated: SALES - Sales Document"
end

puts ""
puts "=== VERIFICATION ==="
DocumentType.where(scope: [ "job", "both" ]).where.not(aliases: nil).order(:abbreviation).each do |dt|
  puts "#{dt.abbreviation}: #{dt.aliases.length} aliases"
end
