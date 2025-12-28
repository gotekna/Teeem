# Add all missing columns to Companies foundation

# SSoT: Use slug lookup, not hardcoded numeric ID (differs per environment)
companies_foundation = Foundation.find_by(slug: "corporate_companies")
unless companies_foundation
  puts "⚠️ Foundation 'corporate_companies' not found - skipping"
  return
end
foundation_id = companies_foundation.id

# Column definitions with appropriate types
columns_to_add = [
  { name: "ID", column_name: "id", column_type: "whole_number", position: 0 },
  { name: "Code", column_name: "code", column_type: "single_line_text", position: 1 },
  { name: "Status", column_name: "status", column_type: "choice", position: 7 },
  { name: "Purpose", column_name: "purpose", column_type: "multiple_lines_text", position: 8 },
  { name: "Is Trustee", column_name: "is_trustee", column_type: "boolean", position: 9 },
  { name: "Trust Name", column_name: "trust_name", column_type: "single_line_text", position: 10 },
  { name: "Registered Office", column_name: "registered_office_address", column_type: "single_line_text", position: 11 },
  { name: "Principal Place of Business", column_name: "principal_place_of_business", column_type: "single_line_text", position: 12 },
  { name: "Corporate Key", column_name: "corporate_key", column_type: "single_line_text", position: 13 },
  { name: "ASIC Username", column_name: "asic_username", column_type: "single_line_text", position: 14 },
  { name: "Review Date", column_name: "review_date", column_type: "date", position: 15 },
  { name: "GST Registration", column_name: "gst_registration_status", column_type: "choice", position: 16 },
  { name: "Accounting Method", column_name: "accounting_method", column_type: "choice", position: 17 },
  { name: "Shares on Issue", column_name: "shares_on_issue", column_type: "whole_number", position: 18 },
  { name: "Carry Forward Losses", column_name: "carry_forward_losses", column_type: "currency", position: 19 },
  { name: "Franking Balance", column_name: "franking_balance", column_type: "currency", position: 20 },
  { name: "Amount Owing", column_name: "amount_owing", column_type: "currency", position: 21 },
  { name: "Abbreviation", column_name: "abbreviation", column_type: "single_line_text", position: 22 },
  { name: "Company Code", column_name: "company_code", column_type: "single_line_text", position: 23 },
  { name: "Health Score", column_name: "health_score", column_type: "whole_number", position: 24 },
  { name: "Health Status", column_name: "health_status", column_type: "choice", position: 25 },
  { name: "Has Loans", column_name: "has_loans", column_type: "boolean", position: 26 },
  { name: "Loan Docs In Place", column_name: "loan_documents_in_place", column_type: "boolean", position: 27 },
  { name: "SharePoint Folder", column_name: "sharepoint_folder_name", column_type: "single_line_text", position: 28 },
  { name: "SharePoint URL", column_name: "sharepoint_folder_url", column_type: "url", position: 29 },
  { name: "Created At", column_name: "created_at", column_type: "date_and_time", position: 30 },
  { name: "Updated At", column_name: "updated_at", column_type: "date_and_time", position: 31 }
]

existing_columns = Column.where(foundation_id: foundation_id).pluck(:column_name)
added_count = 0

puts "Adding missing columns to Companies foundation (#{foundation_id})..."
puts "=" * 80

columns_to_add.each do |col_def|
  if existing_columns.include?(col_def[:column_name])
    puts "⊘ Skipped: #{col_def[:name]} (#{col_def[:column_name]}) - already exists"
    next
  end

  Column.create!(
    foundation_id: foundation_id,
    name: col_def[:name],
    column_name: col_def[:column_name],
    column_type: col_def[:column_type],
    position: col_def[:position],
    required: false
  )

  puts "✓ Added: #{col_def[:name]} (#{col_def[:column_name]})"
  added_count += 1
end

puts "=" * 80
puts "Added #{added_count} new columns"
puts "Total columns now: #{Column.where(foundation_id: foundation_id).count}"
