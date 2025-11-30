class AddPassportAndPhotoToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :passport_number, :string
    add_column :contacts, :photo_url, :string
  end
end
