class AddFamilyAndDirectorFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :is_family_member, :boolean, default: false
    add_column :contacts, :is_potential_director, :boolean, default: false
    add_reference :contacts, :company_group, null: true, foreign_key: true
  end
end
