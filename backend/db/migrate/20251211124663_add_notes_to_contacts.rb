class AddNotesToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :notes, :text
  end
end
