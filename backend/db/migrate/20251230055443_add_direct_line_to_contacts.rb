class AddDirectLineToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :direct_line, :string
  end
end
