namespace :trapid do
  desc "Setup column definitions for Contacts table (ID 214) using Gold Standard column types"
  task setup_contacts_columns: :environment do
    table = Table.find(214)

    puts "Setting up columns for Table 214: #{table.name}"
    puts "Current database_table_name: #{table.database_table_name}"

    # Fix database_table_name if needed
    if table.database_table_name != 'contacts'
      table.update!(database_table_name: 'contacts')
      puts "Updated database_table_name to: contacts"
    end

    # Delete existing columns for this table
    existing_count = Column.where(table_id: 214).count
    if existing_count > 0
      Column.where(table_id: 214).destroy_all
      puts "Deleted #{existing_count} existing column definitions"
    end

    # Column definitions mapping contacts table to Gold Standard column types
    # Format: [column_name, display_name, column_type, position, options]
    columns_config = [
      # Primary identifier
      ['full_name', 'Full Name', 'single_line_text', 1, { is_title: true, searchable: true }],
      ['first_name', 'First Name', 'single_line_text', 2, { searchable: true }],
      ['last_name', 'Last Name', 'single_line_text', 3, { searchable: true }],

      # Contact info - demonstrates email, phone, mobile, url types
      ['email', 'Email', 'email', 4, { searchable: true }],
      ['office_phone', 'Office Phone', 'phone', 5, {}],
      ['mobile_phone', 'Mobile', 'mobile', 6, {}],
      ['website', 'Website', 'url', 7, {}],

      # Address - multiple lines text
      ['address', 'Address', 'multiple_lines_text', 8, {}],

      # Booleans
      ['is_active', 'Active', 'boolean', 9, {}],
      ['sync_with_xero', 'Sync with Xero', 'boolean', 10, {}],
      ['portal_enabled', 'Portal Enabled', 'boolean', 11, {}],
      ['deleted', 'Deleted', 'boolean', 12, {}],

      # Numbers and currency
      ['default_discount', 'Default Discount', 'percentage', 13, {}],
      ['accounts_receivable_outstanding', 'AR Outstanding', 'currency', 14, {}],
      ['accounts_receivable_overdue', 'AR Overdue', 'currency', 15, {}],
      ['accounts_payable_outstanding', 'AP Outstanding', 'currency', 16, {}],
      ['accounts_payable_overdue', 'AP Overdue', 'currency', 17, {}],
      ['rating', 'Rating', 'whole_number', 18, {}],
      ['total_ratings_count', 'Total Ratings', 'whole_number', 19, {}],
      ['trapid_rating', 'Trapid Rating', 'number', 20, {}],
      ['response_rate', 'Response Rate', 'percentage', 21, {}],
      ['avg_response_time', 'Avg Response Time (hrs)', 'whole_number', 22, {}],

      # Choice/dropdown
      ['primary_contact_type', 'Contact Type', 'choice', 23, {}],

      # Lookups
      ['contact_region_id', 'Region', 'lookup', 24, { lookup_display_column: 'contact_region' }],
      ['parent_id', 'Parent Contact', 'lookup', 25, { lookup_display_column: 'parent' }],

      # Date fields
      ['date_of_birth', 'Date of Birth', 'date', 26, {}],

      # DateTime fields
      ['created_at', 'Created', 'date_and_time', 27, {}],
      ['updated_at', 'Updated', 'date_and_time', 28, {}],
      ['last_synced_at', 'Last Synced', 'date_and_time', 29, {}],
      ['portal_welcome_sent_at', 'Portal Welcome Sent', 'date_and_time', 30, {}],

      # Notes - multi-line text
      ['notes', 'Notes', 'multiple_lines_text', 31, { searchable: true }],

      # Additional text fields
      ['supplier_code', 'Supplier Code', 'single_line_text', 32, { is_unique: true }],
      ['tax_number', 'Tax Number (ABN)', 'single_line_text', 33, {}],
      ['xero_id', 'Xero ID', 'single_line_text', 34, {}],
      ['xero_contact_number', 'Xero Contact #', 'single_line_text', 35, {}],
      ['xero_contact_status', 'Xero Status', 'choice', 36, {}],

      # Banking
      ['bank_bsb', 'Bank BSB', 'single_line_text', 37, {}],
      ['bank_account_number', 'Bank Account #', 'single_line_text', 38, {}],
      ['bank_account_name', 'Bank Account Name', 'single_line_text', 39, {}],
    ]

    created_count = 0
    columns_config.each do |col_name, display_name, col_type, position, options|
      Column.create!(
        table_id: 214,
        name: display_name,
        column_name: col_name,
        column_type: col_type,
        position: position,
        searchable: options[:searchable] || false,
        is_title: options[:is_title] || false,
        is_unique: options[:is_unique] || false,
        required: options[:required] || false,
        lookup_display_column: options[:lookup_display_column]
      )
      created_count += 1
    end

    puts "Created #{created_count} column definitions for Contacts table"
    puts "\nColumn types used:"
    Column.where(table_id: 214).group(:column_type).count.each do |type, count|
      puts "  #{type}: #{count}"
    end

    puts "\nDone! Test at: /tables/contacts"
  end
end
