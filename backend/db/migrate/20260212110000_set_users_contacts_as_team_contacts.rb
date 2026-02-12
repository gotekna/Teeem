class SetUsersContactsAsTeamContacts < ActiveRecord::Migration[8.0]
  def up
    # All users with linked contacts should have is_team_contact=true
    # and primary_company_id set to their tenant's billing company's contact.
    #
    # Chain: User → Tenant → billing_company (Corporate) → contact_id (Contact)
    execute <<~SQL
      UPDATE contacts
      SET is_team_contact = TRUE,
          primary_company_id = corporates.contact_id
      FROM users
      INNER JOIN tenants ON tenants.id = users.tenant_id
      INNER JOIN corporates ON corporates.id = tenants.billing_company_id
      WHERE contacts.id = users.contact_id
        AND users.contact_id IS NOT NULL
        AND corporates.contact_id IS NOT NULL
        AND (contacts.is_team_contact = FALSE OR contacts.primary_company_id IS NULL)
    SQL
  end

  def down
    # No-op: can't know which contacts were previously not team contacts
  end
end
