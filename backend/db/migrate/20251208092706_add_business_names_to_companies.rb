class AddBusinessNamesToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :business_names, :string
  end
end
