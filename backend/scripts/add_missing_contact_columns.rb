#!/usr/bin/env ruby
# Script to add missing columns to the contacts table configuration (Table ID 214)
# Note: Column count varies - see COLUMN_SQL_TYPE_MAP in column.rb for current count (34 types)

require_relative '../config/environment'

# Table ID for contacts
CONTACTS_TABLE_ID = 214

# Get the current max position
max_position = Column.where(table_id: CONTACTS_TABLE_ID).maximum(:position) || 0
puts "Current max position: #{max_position}"

# Missing columns to add
missing_columns = [
  { name: 'System Type ID', column_name: 'sys_type_id', column_type: 'whole_number', description: 'System type identifier', position: max_position + 1 },
  { name: 'Parent ID', column_name: 'parent_id', column_type: 'whole_number', description: 'Parent contact ID', position: max_position + 2 },
  { name: 'Drive ID', column_name: 'drive_id', column_type: 'single_line_text', description: 'OneDrive drive identifier', position: max_position + 3 },
  { name: 'Folder ID', column_name: 'folder_id', column_type: 'single_line_text', description: 'OneDrive folder identifier', position: max_position + 4 },
  { name: 'Contact Region ID', column_name: 'contact_region_id', column_type: 'whole_number', description: 'Region identifier', position: max_position + 5 },
  { name: 'Branch', column_name: 'branch', column_type: 'boolean', description: 'Is this a branch location', position: max_position + 6 },
  { name: 'Xero Sync Error', column_name: 'xero_sync_error', column_type: 'multiple_lines_text', description: 'Error message from last Xero sync', position: max_position + 7 },
  { name: 'Contact Types', column_name: 'contact_types', column_type: 'multiple_choice', description: 'All contact type classifications', position: max_position + 8 },
  { name: 'Bill Due Day', column_name: 'bill_due_day', column_type: 'whole_number', description: 'Day of month bills are due', position: max_position + 9 },
  { name: 'Bill Due Type', column_name: 'bill_due_type', column_type: 'choice', description: 'Bill payment term type', position: max_position + 10 },
  { name: 'Sales Due Day', column_name: 'sales_due_day', column_type: 'whole_number', description: 'Day of month sales payments are due', position: max_position + 11 },
  { name: 'Sales Due Type', column_name: 'sales_due_type', column_type: 'choice', description: 'Sales payment term type', position: max_position + 12 },
  { name: 'Default Purchase Account', column_name: 'default_purchase_account', column_type: 'single_line_text', description: 'Default Xero purchase account code', position: max_position + 13 },
  { name: 'Default Sales Account', column_name: 'default_sales_account', column_type: 'single_line_text', description: 'Default Xero sales account code', position: max_position + 14 },
  { name: 'Xero Account Number', column_name: 'xero_account_number', column_type: 'single_line_text', description: 'Xero account number', position: max_position + 15 },
  { name: 'Company Number', column_name: 'company_number', column_type: 'single_line_text', description: 'Company registration number', position: max_position + 16 },
  { name: 'Fax Phone', column_name: 'fax_phone', column_type: 'phone', description: 'Fax number', position: max_position + 17 },
  { name: 'Director ID', column_name: 'director_id', column_type: 'single_line_text', description: 'Director identification number', position: max_position + 18 },
  # Note: passport_number, drivers_license_number, place_of_birth, birth_state, birth_country,
  # current_residential_address columns were removed as unused
  { name: 'Company Name or Trust', column_name: 'company_name_or_trust', column_type: 'single_line_text', description: 'Associated company or trust name', position: max_position + 19 },
  { name: 'Primary Company ID', column_name: 'primary_company_id', column_type: 'whole_number', description: 'Primary company identifier', position: max_position + 20 },
  { name: 'Primary Role', column_name: 'primary_role', column_type: 'single_line_text', description: 'Primary job role/title', position: max_position + 21 },
  { name: 'Employment Status', column_name: 'employment_status', column_type: 'choice', description: 'Current employment status', position: max_position + 22 },
  { name: 'Employment Start Date', column_name: 'employment_start_date', column_type: 'date', description: 'Date employment started', position: max_position + 23 },
  { name: 'Entity Type', column_name: 'entity_type', column_type: 'choice', description: 'Type of legal entity', position: max_position + 24 },
  { name: 'LGAs', column_name: 'lgas', column_type: 'multiple_choice', description: 'Local Government Areas serviced', position: max_position + 25 }
]

puts "\nAdding #{missing_columns.length} missing columns to Table ID #{CONTACTS_TABLE_ID}..."

created_count = 0
error_count = 0

missing_columns.each do |col_data|
  begin
    # Check if column already exists
    existing = Column.find_by(table_id: CONTACTS_TABLE_ID, column_name: col_data[:column_name])

    if existing
      puts "✓ Column '#{col_data[:name]}' already exists (ID: #{existing.id})"
      next
    end

    # Create the column
    column = Column.create!(
      table_id: CONTACTS_TABLE_ID,
      name: col_data[:name],
      column_name: col_data[:column_name],
      column_type: col_data[:column_type],
      description: col_data[:description],
      position: col_data[:position],
      searchable: false,
      is_title: false,
      is_unique: false,
      required: false
    )

    puts "✓ Created column '#{col_data[:name]}' (ID: #{column.id})"
    created_count += 1
  rescue => e
    puts "✗ Error creating column '#{col_data[:name]}': #{e.message}"
    error_count += 1
  end
end

puts "\n" + "="*50
puts "Summary:"
puts "Created: #{created_count}"
puts "Errors: #{error_count}"
puts "Total columns now: #{Column.where(table_id: CONTACTS_TABLE_ID).count}"
puts "="*50
