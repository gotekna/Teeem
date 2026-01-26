class RemoveLegacyGlobalUniqueIndexFromContactTypes < ActiveRecord::Migration[8.0]
  def change
    # Remove legacy global unique index that conflicts with multi-tenant setup
    # The tenant-scoped index (idx_contact_types_tenant_name) already exists
    # This global index prevents same contact type name across tenants
    remove_index :contact_types, name: :index_contact_types_on_name, if_exists: true
  end
end
