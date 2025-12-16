class AddXeroLinkColumnsToContacts < ActiveRecord::Migration[8.0]
  def up
    add_column :contacts, :xero_linked_count, :integer, default: 0
    add_column :contacts, :xero_tenant_names, :string, array: true, default: []

    # Backfill existing data
    puts "Backfilling xero link cache for contacts..."
    execute <<-SQL
      UPDATE contacts
      SET xero_linked_count = subquery.link_count,
          xero_tenant_names = subquery.tenant_names
      FROM (
        SELECT
          contact_id,
          COUNT(*) as link_count,
          ARRAY_AGG(DISTINCT tenant_name) FILTER (WHERE tenant_name IS NOT NULL) as tenant_names
        FROM contact_external_links
        WHERE source = 'xero' AND sync_enabled = true
        GROUP BY contact_id
      ) AS subquery
      WHERE contacts.id = subquery.contact_id
    SQL
    puts "Done!"
  end

  def down
    remove_column :contacts, :xero_linked_count
    remove_column :contacts, :xero_tenant_names
  end
end
