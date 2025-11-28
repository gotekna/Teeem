class CreateCompanyGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :company_groups do |t|
      t.string :name, null: false
      t.text :description
      t.string :default_registered_office
      t.string :default_principal_place
      t.string :default_accountant
      t.string :default_accountant_contact
      t.boolean :active, default: true

      t.timestamps
    end
    add_index :company_groups, :name, unique: true
  end
end
