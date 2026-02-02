# FRC (Feb 2026): Rename tenant_id to xero_org_id for consistency.
# tenant_id was confusing because it stored Xero org UUID, not TEEEM tenant FK.
# Now all Xero org UUIDs use xero_org_id consistently across tables.
class RenameContactExternalLinksTenantIdToXeroOrgId < ActiveRecord::Migration[8.0]
  def change
    # Rename the column
    rename_column :contact_external_links, :tenant_id, :xero_org_id

    # The index will be renamed automatically by Rails
    # Old: index_contact_external_links_on_tenant_id
    # New: index_contact_external_links_on_xero_org_id

    # Update the unique constraint index name
    # Old: idx_contact_external_links_external (source, tenant_id, external_contact_id)
    # Need to recreate with new column name
    remove_index :contact_external_links, name: "idx_contact_external_links_external", if_exists: true
    add_index :contact_external_links, [:source, :xero_org_id, :external_contact_id],
              unique: true,
              name: "idx_contact_external_links_unique"
  end
end
