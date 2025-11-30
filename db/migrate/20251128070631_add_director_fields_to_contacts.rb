class AddDirectorFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    # date_of_birth and director_id already exist
    add_column :contacts, :place_of_birth, :string
    add_column :contacts, :birth_state, :string
    add_column :contacts, :birth_country, :string
    add_column :contacts, :drivers_licence, :string
    add_column :contacts, :residential_address, :text
    add_column :contacts, :tfn, :string  # Will be encrypted at model level
  end
end
