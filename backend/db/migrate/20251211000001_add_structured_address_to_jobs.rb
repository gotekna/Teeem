class AddStructuredAddressToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :lot_number, :string
    add_column :jobs, :street_number, :string
    add_column :jobs, :street_name, :string
    add_column :jobs, :street_type, :string
    add_column :jobs, :suburb, :string
    add_column :jobs, :postcode, :string, limit: 4
    add_column :jobs, :state, :string, limit: 3
    add_column :jobs, :council, :string

    add_index :jobs, :suburb
    add_index :jobs, :postcode
    add_index :jobs, :council
  end
end
