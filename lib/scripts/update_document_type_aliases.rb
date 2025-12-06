# Update Document Types with aliases for better auto-classification
puts "=== UPDATING DOCUMENT TYPE ALIASES ==="
puts ""

updates = {
  # Plans - catch "lot XX address" patterns
  "SPLAN" => {
    aliases: [ "sales plan", "lot plan", "presentation plan", "westridge", "lot 83", "lot plan" ],
    file_extensions: [ ".pdf" ]
  },

  # Council - catch referral agency, minor change, approval patterns
  "COUNCIL" => {
    aliases: [ "council approval", "council permit", "referral agency", "minor change", "existing approval",
              "development approval", "concurrence", "car24", "decision notice", "driveway", "crossover" ],
    file_extensions: [ ".pdf" ]
  },

  # Contracts - catch Form 1 and building forms
  "JCON" => {
    aliases: [ "job contract", "building contract", "qbcc contract", "reiq contract", "form 1",
              "form1", "building application", "engagement", "agreement" ],
    file_extensions: [ ".pdf" ]
  },

  # Colour Selection - catch product specs, fixtures
  "COLOR" => {
    aliases: [ "colour selection", "color selection", "selections", "vanity", "sink", "tap", "mixer",
              "faucet", "subline", "blanco", "specsheet", "spec sheet", "userguide", "user guide",
              "userinstall", "product spec", "fixture spec", "appliance spec", "haier", "bosch" ],
    file_extensions: [ ".pdf", ".docx", ".xlsx", ".zip" ]
  },

  # Certification - catch install documents
  "CERT" => {
    aliases: [ "certification", "certificate", "compliance", "install", "installation",
              "form 12", "form 15", "form 43", "inspection", "termite", "waterproof",
              "glazing", "smoke alarm", "stormwater", "roof form" ],
    file_extensions: [ ".pdf" ]
  },

  # Revit/Engineering
  "RVT" => {
    aliases: [ "revit project", "revit model", "architectural model" ],
    file_extensions: [ ".rvt" ]
  },

  "RFA" => {
    aliases: [ "revit family", "revit component" ],
    file_extensions: [ ".rfa" ]
  },

  "DWG" => {
    aliases: [ "autocad drawing", "cad drawing", "engineering drawing", "truss", "design" ],
    file_extensions: [ ".dwg" ]
  },

  # Energy
  "HEBS" => {
    aliases: [ "energy compliance", "energy efficiency", "ee assessment", "hebs", "nathers",
              "energy report", "energy rating" ],
    file_extensions: [ ".pdf" ]
  },

  # Land/Survey
  "LAND" => {
    aliases: [ "land survey", "survey", "site survey", "setout", "soil test", "site class",
              "geotechnical", "disclosure plan", "ascon", "infrastructure" ],
    file_extensions: [ ".pdf", ".dwg" ]
  },

  # Photos
  "PHOTO" => {
    aliases: [ "site photo", "progress photo", "construction photo" ],
    file_extensions: [ ".jpg", ".jpeg", ".png", ".heic" ]
  },

  # Estimation
  "EST" => {
    aliases: [ "estimation", "estimate", "quote", "quotation", "price", "pricing",
              "purchase order", "po ", "invoice" ],
    file_extensions: [ ".pdf", ".xlsx" ]
  },

  # Final Approval docs
  "F21" => {
    aliases: [ "form 21", "form21", "final inspection certificate" ],
    file_extensions: [ ".pdf" ]
  },

  "FINAL" => {
    aliases: [ "final approval", "final certificate", "final inspection", "form 16", "form16" ],
    file_extensions: [ ".pdf" ]
  },

  # Plumbing
  "PLUMB" => {
    aliases: [ "plumbing certificate", "plumbing permit", "plumbing approval", "drainage",
              "drains", "plumber" ],
    file_extensions: [ ".pdf" ]
  }
}

updates.each do |abbrev, attrs|
  dt = DocumentType.find_by(abbreviation: abbrev)
  if dt
    dt.update!(
      aliases: attrs[:aliases],
      file_extensions: attrs[:file_extensions]
    )
    puts "Updated #{abbrev}: #{attrs[:aliases].length} aliases, #{attrs[:file_extensions].length} extensions"
  else
    puts "NOT FOUND: #{abbrev}"
  end
end

puts ""
puts "=== VERIFICATION ==="
DocumentType.where(scope: [ "job", "both" ]).order(:abbreviation).each do |dt|
  next if dt.aliases.blank?
  puts "#{dt.abbreviation}: #{dt.aliases.first(5).join(', ')}#{dt.aliases.length > 5 ? '...' : ''}"
end
