class FixContactsUniqueCompanyNameTenantScope < ActiveRecord::Migration[8.0]
  def up
    # FRC: The unique index on contacts.display_name was NOT scoped to tenant_id,
    # causing cross-tenant collisions. A company "Pre Hung Doors" in Tenant 1
    # blocked Tenant 2 from having a company with the same name.
    remove_index :contacts, name: "idx_contacts_unique_company_name"

    add_index :contacts,
              "tenant_id, lower(TRIM(BOTH FROM display_name))",
              name: "idx_contacts_unique_company_name",
              unique: true,
              where: "entity_type = 'company' AND is_active = true"
  end

  def down
    remove_index :contacts, name: "idx_contacts_unique_company_name"

    add_index :contacts,
              "lower(TRIM(BOTH FROM display_name))",
              name: "idx_contacts_unique_company_name",
              unique: true,
              where: "entity_type = 'company' AND is_active = true"
  end
end
