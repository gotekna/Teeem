# Create missing document types on live
puts "=== CREATING MISSING DOCUMENT TYPES ==="
puts ""

missing_types = [
  {
    abbreviation: "SPLAN",
    name: "Sales Plan",
    target_folder: "04 Plans/Sales Plans",
    folder: "PLANS",
    naming_format: "{CompanyCode} {JobCode} Sales Plan {Date}",
    scope: "job",
    category: "general",
    aliases: [ "sales plan", "lot plan", "presentation plan" ],
    file_extensions: [ ".pdf" ],
    active: true
  },
  {
    abbreviation: "COUNCIL",
    name: "Council Approval",
    target_folder: "03 Certification/Council",
    folder: "CERTIFICATION",
    naming_format: "{CompanyCode} {JobCode} Council Approval {Date}",
    scope: "job",
    category: "compliance",
    aliases: [ "council approval", "council permit", "referral agency", "minor change", "existing approval",
              "development approval", "concurrence", "car24", "decision notice", "driveway", "crossover" ],
    file_extensions: [ ".pdf" ],
    active: true
  },
  {
    abbreviation: "EST",
    name: "Estimation",
    target_folder: "02 PreCon/Estimation",
    folder: "PRECON",
    naming_format: "{CompanyCode} {JobCode} Estimation {Date}",
    scope: "job",
    category: "general",
    aliases: [ "estimation", "estimate", "quote", "quotation", "price", "pricing",
              "purchase order", "invoice" ],
    file_extensions: [ ".pdf", ".xlsx" ],
    active: true
  },
  {
    abbreviation: "F21",
    name: "Form 21",
    target_folder: "07 Final Approval/Form 21",
    folder: "FINAL",
    naming_format: "{CompanyCode} {JobCode} Form 21 {Date}",
    scope: "job",
    category: "compliance",
    aliases: [ "form 21", "form21", "final inspection certificate" ],
    file_extensions: [ ".pdf" ],
    active: true
  },
  {
    abbreviation: "FINAL",
    name: "Final Approval",
    target_folder: "03 Certification/Final Approval",
    folder: "CERTIFICATION",
    naming_format: "{CompanyCode} {JobCode} Final Approval {Date}",
    scope: "job",
    category: "compliance",
    aliases: [ "final approval", "final certificate", "final inspection", "form 16", "form16" ],
    file_extensions: [ ".pdf" ],
    active: true
  },
  {
    abbreviation: "PLUMB",
    name: "Plumbing Certificate",
    target_folder: "03 Certification/Plumbing",
    folder: "CERTIFICATION",
    naming_format: "{CompanyCode} {JobCode} Plumbing Cert {Date}",
    scope: "job",
    category: "compliance",
    aliases: [ "plumbing certificate", "plumbing permit", "plumbing approval", "drainage",
              "drains", "plumber" ],
    file_extensions: [ ".pdf" ],
    active: true
  },
  {
    abbreviation: "NDIS",
    name: "NDIS Certification",
    target_folder: "03 Certification/NDIS",
    folder: "CERTIFICATION",
    naming_format: "{CompanyCode} {JobCode} NDIS Cert {Date}",
    scope: "job",
    category: "compliance",
    aliases: [ "ndis certification", "ndis approval", "sda", "specialist disability" ],
    file_extensions: [ ".pdf" ],
    active: true
  },
  {
    abbreviation: "CPLAN",
    name: "Certified Plan",
    target_folder: "04 Plans/Certified Plans",
    folder: "PLANS",
    naming_format: "{CompanyCode} {JobCode} Certified Plan {Date}",
    scope: "job",
    category: "compliance",
    aliases: [ "certified plan", "certification plan", "approved plan" ],
    file_extensions: [ ".pdf" ],
    active: true
  },
  {
    abbreviation: "WDRAW",
    name: "Working Drawing",
    target_folder: "04 Plans/Working Drawings",
    folder: "PLANS",
    naming_format: "{CompanyCode} {JobCode} Working Drawing {Description}",
    scope: "job",
    category: "general",
    aliases: [ "working drawing", "wd plan", "construction drawing" ],
    file_extensions: [ ".pdf", ".dwg" ],
    active: true
  }
]

missing_types.each do |attrs|
  dt = DocumentType.find_or_initialize_by(abbreviation: attrs[:abbreviation])
  dt.assign_attributes(attrs)
  if dt.new_record?
    dt.save!
    puts "Created: #{attrs[:abbreviation]} - #{attrs[:name]}"
  else
    dt.save!
    puts "Updated: #{attrs[:abbreviation]} - #{attrs[:name]}"
  end
end

puts ""
puts "=== ALL JOB DOCUMENT TYPES ==="
DocumentType.where(scope: [ "job", "both" ]).order(:target_folder, :abbreviation).each do |dt|
  aliases_preview = dt.aliases.present? ? " (#{dt.aliases.length} aliases)" : ""
  puts "#{dt.abbreviation.ljust(8)} #{dt.name.ljust(25)} -> #{dt.target_folder}#{aliases_preview}"
end
