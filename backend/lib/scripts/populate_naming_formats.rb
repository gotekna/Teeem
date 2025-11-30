#!/usr/bin/env ruby
# Script to populate naming formats and abbreviations for existing document types

puts "=== Populating Naming Formats for Document Types ==="

# Define abbreviations and naming formats for each document type
formats = {
  # ATO/Tax
  "CTR - Company Tax Return" => { abbrev: "CTR", format: "{CompanyCode} CTR FY{YY}" },
  "TTR - Trust Tax Return" => { abbrev: "TTR", format: "{CompanyCode} TTR FY{YY}" },
  "BAS - Business Activity Statement" => { abbrev: "BAS", format: "{CompanyCode} BAS {Period} FY{YY}" },
  "Tax Consolidation Schedule" => { abbrev: "TCS", format: "{CompanyCode} Tax Consolidation Schedule FY{YY}" },
  "ATO Documents" => { abbrev: "ATO", format: "{CompanyCode} ATO {Description} {Date}" },

  # FINANCIALS
  "Final Financials" => { abbrev: "FS", format: "{CompanyCode} Final Financials FY{YY}" },
  "Final Financials - Signed" => { abbrev: "FSS", format: "{CompanyCode} Final Financials FY{YY} Signed" },
  "Draft Financials" => { abbrev: "DFS", format: "{CompanyCode} Draft Financials FY{YY}" },

  # LOANS
  "PPSR Registration" => { abbrev: "PPSR", format: "{CompanyCode} {LoanID} PPSR {AssetCode} {Date}" },
  "Security Deed" => { abbrev: "SD", format: "{CompanyCode} {LoanID} Security Deed {AssetCode} {Date}" },
  "Security Deed - Draft" => { abbrev: "SDD", format: "{CompanyCode} {LoanID} Security Deed Draft {AssetCode} {Date}" },
  "Security Deed - Signed" => { abbrev: "SDS", format: "{CompanyCode} {LoanID} Security Deed Signed {AssetCode} {Date}" },
  "Loan Agreement" => { abbrev: "LA", format: "{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} {Date}" },
  "Loan Agreement - Draft" => { abbrev: "LAD", format: "{CompanyCode} {LoanID} Loan Draft from {LenderCode} {AssetCode} {Date}" },
  "Loan Agreement - Signed" => { abbrev: "LAS", format: "{CompanyCode} {LoanID} Loan Signed from {LenderCode} {AssetCode} {Date}" },
  "Loan Agreement - Lender Copy" => { abbrev: "LAL", format: "{CompanyCode} {LoanID} Loan Lender Copy {AssetCode} {Date}" },

  # MINUTES
  "Directors' Minutes" => { abbrev: "MIN", format: "{CompanyCode} Minutes {Date}" },
  "Minutes - Draft" => { abbrev: "MIND", format: "{CompanyCode} Minutes Draft {Date}" },
  "Minutes - Signed" => { abbrev: "MINS", format: "{CompanyCode} Minutes Signed {Date}" },

  # DIVIDENDS
  "Dividend Declaration" => { abbrev: "DIV", format: "{CompanyCode} Dividend Declaration FY{YY}" },
  "Dividend Payment Record" => { abbrev: "DIVR", format: "{CompanyCode} Dividend Payment Record FY{YY}" },
  "Distribution Declaration" => { abbrev: "DIST", format: "{CompanyCode} Distribution Declaration FY{YY}" },
  "Distribution - Draft" => { abbrev: "DISTD", format: "{CompanyCode} Distribution Draft FY{YY}" },
  "Distribution - Signed" => { abbrev: "DISTS", format: "{CompanyCode} Distribution Signed FY{YY}" },
  "Gift Deed" => { abbrev: "GD", format: "{CompanyCode} Gift Deed {Date}" },
  "Gift Deed - Signed" => { abbrev: "GDS", format: "{CompanyCode} Gift Deed Signed {Date}" },
  "Gift Deed Return" => { abbrev: "GDR", format: "{CompanyCode} Gift Deed Return {Date}" },

  # GENERAL
  "Constitution" => { abbrev: "CON", format: "{CompanyCode} Constitution {Date}" },
  "General" => { abbrev: "GEN", format: "{CompanyCode} {Description} {Date}" },
  "Structure" => { abbrev: "STRUC", format: "{CompanyCode} Structure {Date}" },
  "Trust" => { abbrev: "TR", format: "{CompanyCode} Trust {Description} {Date}" },

  # REGISTRY
  "Share Registry" => { abbrev: "SR", format: "{CompanyCode} Share Registry {Date}" },
  "Share Certificate" => { abbrev: "SC", format: "{CompanyCode} Share Certificate {Date}" },
  "Share Transfer" => { abbrev: "ST", format: "{CompanyCode} Share Transfer {Date}" },
  "Register of Members" => { abbrev: "ROM", format: "{CompanyCode} Register of Members {Date}" },

  # ASSETS
  "Asset" => { abbrev: "ASSET", format: "{CompanyCode} {AssetCode} {Description} {Date}" },
  "Asset Insurance - Draft" => { abbrev: "AINSD", format: "{CompanyCode} {AssetCode} Insurance Draft {Date}" },
  "Asset Insurance - Signed" => { abbrev: "AINSS", format: "{CompanyCode} {AssetCode} Insurance Signed {Date}" },
  "Purchase Contract - Draft" => { abbrev: "PCD", format: "{CompanyCode} {AssetCode} Purchase Contract Draft {Date}" },
  "Purchase Contract - Signed" => { abbrev: "PCS", format: "{CompanyCode} {AssetCode} Purchase Contract Signed {Date}" },
  "Service Agreement - Draft" => { abbrev: "SAD", format: "{CompanyCode} {AssetCode} Service Agreement Draft {Date}" },
  "Service Agreement - Signed" => { abbrev: "SAS", format: "{CompanyCode} {AssetCode} Service Agreement Signed {Date}" },

  # BANK
  "Bank Statement" => { abbrev: "BANK", format: "{CompanyCode} Bank Statement {Period} FY{YY}" },

  # Other
  "Disposal" => { abbrev: "DISP", format: "{CompanyCode} Disposal {AssetCode} {Date}" },
  "Expenses" => { abbrev: "EXP", format: "{CompanyCode} Expenses {Description} {Date}" },
  "Purchases" => { abbrev: "PURCH", format: "{CompanyCode} Purchases {Description} {Date}" },
  "Valuation" => { abbrev: "VAL", format: "{CompanyCode} Valuation {AssetCode} {Date}" }
}

updated = 0
not_found = []

formats.each do |name, data|
  dt = DocumentType.find_by(name: name)
  if dt
    dt.update!(abbreviation: data[:abbrev], naming_format: data[:format])
    puts "  Updated: #{name} -> [#{data[:abbrev]}] #{data[:format]}"
    updated += 1
  else
    not_found << name
  end
end

puts ""
puts "Updated #{updated} document types"

if not_found.any?
  puts ""
  puts "Not found (#{not_found.count}):"
  not_found.each { |n| puts "  - #{n}" }
end

# Show remaining types without formats
remaining = DocumentType.where(naming_format: nil).pluck(:name)
if remaining.any?
  puts ""
  puts "Types still without format (#{remaining.count}):"
  remaining.each { |n| puts "  - #{n}" }
end
