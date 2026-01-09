class AddStructuredAddressFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :city, :string
    add_column :contacts, :state, :string
    add_column :contacts, :postcode, :string
  end
end
