class AddXeroLinksColumnsToFoundation < ActiveRecord::Migration[8.0]
  def up
    contacts_foundation = ::Foundation.find_by(database_table_name: 'contacts')
    return unless contacts_foundation

    # Add xero_linked_count if missing
    unless contacts_foundation.columns.exists?(column_name: 'xero_linked_count')
      contacts_foundation.columns.create!(
        column_name: 'xero_linked_count',
        name: 'Xero Links',
        column_type: 'whole_number',
        column_group: 'Xero'
      )
      puts "Added xero_linked_count column to Foundation"
    end

    # Add xero_tenant_names if missing
    unless contacts_foundation.columns.exists?(column_name: 'xero_tenant_names')
      contacts_foundation.columns.create!(
        column_name: 'xero_tenant_names',
        name: 'Xero Orgs',
        column_type: 'array_of_items',
        column_group: 'Xero'
      )
      puts "Added xero_tenant_names column to Foundation"
    end
  end

  def down
    contacts_foundation = ::Foundation.find_by(database_table_name: 'contacts')
    return unless contacts_foundation

    contacts_foundation.columns.find_by(column_name: 'xero_linked_count')&.destroy
    contacts_foundation.columns.find_by(column_name: 'xero_tenant_names')&.destroy
  end
end
