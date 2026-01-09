class RenameContactXeroLinksToContactExternalLinks < ActiveRecord::Migration[8.0]
  def change
    # Rename table
    rename_table :contact_xero_links, :contact_external_links

    # Add source column (xero, myob, quickbooks)
    add_column :contact_external_links, :source, :string, default: 'xero', null: false

    # Rename xero-specific columns to generic names
    rename_column :contact_external_links, :xero_tenant_id, :tenant_id
    rename_column :contact_external_links, :xero_tenant_name, :tenant_name
    rename_column :contact_external_links, :xero_contact_id, :external_contact_id
    rename_column :contact_external_links, :xero_last_modified_at, :external_last_modified_at

    # Add index on source
    add_index :contact_external_links, :source

    # Update unique constraints - remove old ones, add new with source
    remove_index :contact_external_links, name: 'idx_contact_xero_links_contact_tenant'
    remove_index :contact_external_links, name: 'idx_contact_xero_links_tenant_xero_id'

    add_index :contact_external_links, [ :contact_id, :source, :tenant_id ],
              unique: true, name: 'idx_contact_external_links_unique'
    add_index :contact_external_links, [ :source, :tenant_id, :external_contact_id ],
              unique: true, name: 'idx_contact_external_links_external'
  end
end
