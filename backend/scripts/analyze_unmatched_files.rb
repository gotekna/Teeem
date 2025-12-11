require 'csv'

puts "=" * 80
puts "UNMATCHED FILES ANALYSIS & RECOMMENDATIONS"
puts "=" * 80

# Read the match analysis CSV
csv_path = ARGV[0] || "/Users/robertharder/GitHub/teeem/sharepoint_match_analysis.csv"
rows = CSV.read(csv_path, headers: true)

# Filter to unmatched files only
unmatched = rows.select { |r| r['confidence'] == 'none' }

puts "\nTotal unmatched files: #{unmatched.count}"

# Group by common patterns
patterns = Hash.new { |h, k| h[k] = [] }

unmatched.each do |row|
  filename = row['filename']

  # Extract pattern keywords
  case filename
  when /profit.*loss/i
    patterns['Profit & Loss Statement'] << filename
  when /balance.*sheet/i
    patterns['Balance Sheet'] << filename
  when /invoice/i
    patterns['Invoice'] << filename
  when /receipt/i
    patterns['Receipt'] << filename
  when /quote/i
    patterns['Quote'] << filename
  when /proposal/i
    patterns['Proposal'] << filename
  when /agreement/i
    patterns['Agreement'] << filename
  when /policy/i
    patterns['Policy'] << filename
  when /certificate/i
    patterns['Certificate'] << filename
  when /license/i
    patterns['License'] << filename
  when /permit/i
    patterns['Permit'] << filename
  when /approval/i
    patterns['Approval'] << filename
  when /passport/i
    patterns['Passport'] << filename
  when /driver.*license/i
    patterns['Driver License'] << filename
  when /medicare/i
    patterns['Medicare Card'] << filename
  when /birth.*certificate/i
    patterns['Birth Certificate'] << filename
  when /marriage.*certificate/i
    patterns['Marriage Certificate'] << filename
  when /\d{8}No\d+of\d+/
    patterns['Personal ID Documents (Numbered Series)'] << filename
  when /living.*dream/i, /livin.*dream/i
    patterns['Living the Dream (Project/Property)'] << filename
  when /^[A-Z]{2,4}\s+\d/
    patterns['Code-Prefixed Documents'] << filename
  when /minutes/i
    patterns['Minutes (Unmatched)'] << filename
  when /resolution/i
    patterns['Resolution (Unmatched)'] << filename
  when /report/i
    patterns['Report'] << filename
  when /statement/i
    patterns['Statement (Generic)'] << filename
  when /notice/i
    patterns['Notice'] << filename
  when /letter/i
    patterns['Letter'] << filename
  when /memo/i
    patterns['Memo'] << filename
  when /email/i
    patterns['Email'] << filename
  else
    patterns['Other/Uncategorized'] << filename
  end
end

puts "\n" + "=" * 80
puts "PATTERN ANALYSIS"
puts "=" * 80

patterns.sort_by { |_pattern, files| -files.count }.each do |pattern, files|
  puts "\n#{pattern}: #{files.count} files"
  puts "  Sample: #{files.first(3).join(', ')}"
end

puts "\n" + "=" * 80
puts "RECOMMENDATIONS"
puts "=" * 80

recommendations = [
  {
    name: "Profit & Loss Statement",
    abbreviation: "P&L",
    folder: "FINANCIALS",
    category: "financial",
    aliases: [ "P&L", "Profit and Loss", "Income Statement", "P L Statement" ],
    file_name_template: "{CompanyCode} P&L {PeriodLong} FY{YY}",
    display_name_template: "P&L {PeriodLong} FY{YY}",
    estimated_files: patterns['Profit & Loss Statement'].count
  },
  {
    name: "Balance Sheet",
    abbreviation: "BS",
    folder: "FINANCIALS",
    category: "financial",
    aliases: [ "Balance Sheet", "Statement of Financial Position" ],
    file_name_template: "{CompanyCode} Balance Sheet {Date}",
    display_name_template: "Balance Sheet {Date}",
    estimated_files: patterns['Balance Sheet'].count
  },
  {
    name: "Passport",
    abbreviation: "PASS",
    folder: "PEOPLE",
    category: "people",
    aliases: [ "Passport", "Australian Passport", "Travel Document" ],
    file_name_template: "{PersonName} Passport {Date}",
    display_name_template: "Passport {Date}",
    estimated_files: patterns['Passport'].count + patterns['Personal ID Documents (Numbered Series)'].count
  },
  {
    name: "Driver License",
    abbreviation: "DL",
    folder: "PEOPLE",
    category: "people",
    aliases: [ "Driver License", "Drivers Licence", "DL", "Licence" ],
    file_name_template: "{PersonName} Driver License {Date}",
    display_name_template: "Driver License {Date}",
    estimated_files: patterns['Driver License'].count
  },
  {
    name: "Medicare Card",
    abbreviation: "MEDI",
    folder: "PEOPLE",
    category: "people",
    aliases: [ "Medicare", "Medicare Card" ],
    file_name_template: "{PersonName} Medicare Card {Date}",
    display_name_template: "Medicare Card {Date}",
    estimated_files: patterns['Medicare Card'].count
  },
  {
    name: "Birth Certificate",
    abbreviation: "BC",
    folder: "PEOPLE",
    category: "people",
    aliases: [ "Birth Certificate", "BC" ],
    file_name_template: "{PersonName} Birth Certificate",
    display_name_template: "Birth Certificate",
    estimated_files: patterns['Birth Certificate'].count
  },
  {
    name: "Invoice",
    abbreviation: "INV",
    folder: "GENERAL",
    category: "general",
    aliases: [ "Invoice", "Tax Invoice", "INV" ],
    file_name_template: "{CompanyCode} Invoice {InvoiceNum} {Date}",
    display_name_template: "Invoice {InvoiceNum} {Date}",
    estimated_files: patterns['Invoice'].count
  },
  {
    name: "Receipt",
    abbreviation: "REC",
    folder: "GENERAL",
    category: "general",
    aliases: [ "Receipt", "Payment Receipt", "REC" ],
    file_name_template: "{CompanyCode} Receipt {Date}",
    display_name_template: "Receipt {Date}",
    estimated_files: patterns['Receipt'].count
  },
  {
    name: "Notice",
    abbreviation: "NOT",
    folder: "GENERAL",
    category: "general",
    aliases: [ "Notice", "Official Notice", "NOT" ],
    file_name_template: "{CompanyCode} Notice {Date}",
    display_name_template: "Notice {Date}",
    estimated_files: patterns['Notice'].count
  },
  {
    name: "Report",
    abbreviation: "REP",
    folder: "GENERAL",
    category: "general",
    aliases: [ "Report", "REP" ],
    file_name_template: "{CompanyCode} Report {Description} {Date}",
    display_name_template: "Report {Description} {Date}",
    estimated_files: patterns['Report'].count
  }
]

puts "\n📋 NEW DOCUMENT TYPES TO CREATE:"
puts "-" * 80

recommendations.each_with_index do |rec, idx|
  next if rec[:estimated_files] == 0

  puts "\n#{idx + 1}. #{rec[:name]}"
  puts "   Abbreviation: #{rec[:abbreviation]}"
  puts "   Folder/Tab: #{rec[:folder]}"
  puts "   Category: #{rec[:category]}"
  puts "   Estimated Files: #{rec[:estimated_files]}"
  puts "   File Name: #{rec[:file_name_template]}"
  puts "   Display Name: #{rec[:display_name_template]}"
  puts "   Aliases: #{rec[:aliases].join(', ')}"
end

puts "\n" + "=" * 80
puts "ALIASES TO ADD TO EXISTING DOCUMENT TYPES:"
puts "-" * 80

alias_suggestions = [
  {
    existing_type: "Minutes",
    add_aliases: [ "Meeting Minutes", "Board Meeting", "Directors Meeting", "Shareholders Meeting" ],
    reason: "#{patterns['Minutes (Unmatched)'].count} files with 'minutes' not matching existing type"
  },
  {
    existing_type: "Resolution",
    add_aliases: [ "Board Resolution", "Shareholders Resolution", "Directors Resolution" ],
    reason: "#{patterns['Resolution (Unmatched)'].count} files with 'resolution' not matching existing type"
  }
]

alias_suggestions.each do |sug|
  next if sug[:reason].start_with?("0 files")

  puts "\n• #{sug[:existing_type]}"
  puts "  Add aliases: #{sug[:add_aliases].join(', ')}"
  puts "  Reason: #{sug[:reason]}"
end

puts "\n" + "=" * 80
puts "SUMMARY"
puts "=" * 80

total_with_new_types = recommendations.sum { |r| r[:estimated_files] }
puts "\nWith recommended new DocumentTypes:"
puts "  • Currently matched: 1,998 files (75.3%)"
puts "  • Would be matched: +#{total_with_new_types} files"
puts "  • New total matched: #{1998 + total_with_new_types} files (#{((1998 + total_with_new_types) * 100.0 / 2655).round(1)}%)"
puts "  • Remaining unmatched: #{657 - total_with_new_types} files"

puts "\n" + "=" * 80
