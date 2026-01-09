class AddEmailDomainsToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :email_domains, :jsonb, default: [], null: false,
      comment: "Email domains for auto-linking employees (e.g., ['tekna.com.au', 'bunnings.com.au']). Used by rake task to create employee_of relationships."
  end
end
