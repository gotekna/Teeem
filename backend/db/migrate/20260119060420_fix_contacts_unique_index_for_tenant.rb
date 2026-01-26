class FixContactsUniqueIndexForTenant < ActiveRecord::Migration[8.0]
  def change
    # Fix SSoT violation: contact_code unique index should be tenant-scoped
    # Old index prevented same contact_code in different tenants
    remove_index :contacts, :contact_code, unique: true, if_exists: true
    add_index :contacts, [:company_group_id, :contact_code], unique: true,
              name: "index_contacts_on_tenant_and_contact_code",
              where: "contact_code IS NOT NULL"
  end
end
