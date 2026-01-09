class AddXeroContactTypesToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :xero_contact_types, :text, array: true, default: []
    add_index :contacts, :xero_contact_types, using: :gin
  end
end
