class AddXeroLinkedCountColumnToContactsFoundation < ActiveRecord::Migration[8.0]
  def up
    # Find Contacts foundation
    contacts_foundation = Foundation.find_by(database_table_name: 'contacts') ||
                         Foundation.find_by(slug: 'contacts')

    unless contacts_foundation
      puts "WARNING: Contacts foundation not found, skipping"
      return
    end

    puts "Found Contacts foundation (id: #{contacts_foundation.id})"

    # Get max position for Xero group columns
    xero_columns = contacts_foundation.columns.where("column_name LIKE 'xero%'")
    max_position = xero_columns.maximum(:position) || 90

    # Columns to add - these are computed from contact_external_links (SSoT)
    new_columns = [
      {
        column_name: 'xero_linked_count',
        name: 'Xero Links',
        column_type: 'whole_number',
        column_group: 'Xero',
        searchable: false,
        position: max_position + 1,
        description: 'Number of Xero organizations this contact is linked to (computed from contact_external_links)'
      },
      {
        column_name: 'xero_tenant_names',
        name: 'Xero Orgs',
        column_type: 'array_of_items',
        column_group: 'Xero',
        searchable: false,
        position: max_position + 2,
        description: 'Names of Xero organizations this contact is linked to'
      }
    ]

    # Add each column if it doesn't already exist
    new_columns.each do |col_attrs|
      existing = contacts_foundation.columns.find_by(column_name: col_attrs[:column_name])

      if existing
        puts "Column #{col_attrs[:column_name]} already exists, skipping"
      else
        column = contacts_foundation.columns.create!(col_attrs)
        puts "Created column: #{column.name} (#{column.column_type})"
      end
    end

    puts "Xero link columns added to Contacts foundation successfully"
  end

  def down
    contacts_foundation = Foundation.find_by(database_table_name: 'contacts') ||
                         Foundation.find_by(slug: 'contacts')
    return unless contacts_foundation

    %w[xero_linked_count xero_tenant_names].each do |col_name|
      column = contacts_foundation.columns.find_by(column_name: col_name)
      if column
        column.destroy
        puts "Removed column: #{col_name}"
      end
    end
  end
end
