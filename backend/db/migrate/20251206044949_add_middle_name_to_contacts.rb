class AddMiddleNameToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :middle_name, :string
  end
end
