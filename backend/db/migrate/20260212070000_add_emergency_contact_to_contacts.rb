class AddEmergencyContactToContacts < ActiveRecord::Migration[7.2]
  def change
    add_column :contacts, :emergency_contact_name, :string
    add_column :contacts, :emergency_contact_phone, :string
    add_column :contacts, :emergency_contact_relationship, :string
  end
end
