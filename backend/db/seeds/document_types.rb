# Seed document types from Corporate File spreadsheet
# Run with: rails runner db/seeds/document_types.rb

document_types = [
  { name: 'Loan Agreement', folder: 'Loans and Security', description: 'Loan Docs', category: 'corporate' },
  { name: 'Security Deed', folder: 'Loans and Security', description: 'Security Deed', category: 'corporate' },
  { name: 'Return of Gift Deed', folder: 'Loans and Security', description: 'Return of Gift Deed', category: 'corporate' },
  { name: 'PPSR', folder: 'Loans and Security', description: 'PPSR registration', category: 'corporate' },
  { name: 'Company Setup', folder: 'Company Setup', description: 'Set Up Docs', category: 'corporate' },
  { name: 'Constitution', folder: 'Constitution', description: 'Constitution', category: 'corporate' },
  { name: 'Members', folder: 'Register of Members', description: 'Shareholdings', category: 'corporate' },
  { name: 'Structure', folder: 'Structure', description: 'Structure Chart', category: 'corporate' },
  { name: 'Asset', folder: 'Assets', description: 'Anything we purchase over $300', category: 'corporate' },
  { name: 'Minutes', folder: 'Minutes', description: 'All minutes', category: 'corporate' },
  { name: 'Distribution Minutes', folder: 'Minutes', description: 'Distribution Minutes FY', category: 'corporate' },
  { name: 'BAS', folder: 'BAS', description: 'BAS Reports', category: 'tax' },
  { name: 'Solvency ASIC', folder: 'General', description: 'Annual ASIC Bill and Solvency', category: 'compliance', requires_filing: true },
  { name: 'ATO Tax Return', folder: 'General', description: 'Once it Signed', category: 'tax', requires_filing: true },
  { name: 'Dividends', folder: 'General', description: 'Dividend statement', category: 'corporate' },
  { name: 'EOY ATO', folder: 'General', description: 'Income tax, activity statement', category: 'tax', requires_filing: true },
  { name: 'ASIC Docs', folder: 'General', description: 'Permission to use registered office', category: 'compliance' },
  { name: 'ATO Docs', folder: 'General', description: 'All ATO docs other', category: 'tax' },
  { name: 'ASIC Key', folder: 'General', description: 'ASIC Key/Corporate Key', category: 'compliance' },
  { name: 'Corporate Key', folder: 'General', description: 'Corporate Key credentials', category: 'compliance' },
  { name: 'Officers', folder: 'General', description: 'If change directors or secretary', category: 'compliance', requires_filing: true },
  { name: 'Bank Statements', folder: 'General', description: 'All statements for the year', category: 'general' },
  { name: 'Distribution', folder: 'General', description: 'Trust document', category: 'corporate' },
  { name: 'EOY ASIC', folder: 'General', description: 'Company details and amount over', category: 'compliance', requires_filing: true },
  { name: 'Trust Deed', folder: 'Trust Deed', description: 'Trust deed documents', category: 'corporate' },
  { name: 'Tax Consolidation', folder: 'General', description: 'Tax consolidation documents', category: 'tax' },
  { name: 'Registered Office', folder: 'General', description: 'Registered office documents', category: 'compliance' }
]

puts "Seeding #{document_types.count} document types..."

document_types.each do |dt|
  record = DocumentType.find_or_initialize_by(name: dt[:name])
  record.assign_attributes(dt)
  if record.save
    puts "  Created/updated: #{dt[:name]}"
  else
    puts "  ERROR: #{dt[:name]} - #{record.errors.full_messages.join(', ')}"
  end
end

puts "Done! Total document types: #{DocumentType.count}"
