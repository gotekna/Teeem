class AddLinkedCompanyIdToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :linked_company_id, :integer
  end
end
