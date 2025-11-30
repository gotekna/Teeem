class AddCodesToCompaniesAndAssets < ActiveRecord::Migration[8.0]
  def change
    # Add code to companies (e.g., TD for Tekna Drafting)
    add_column :companies, :code, :string
    add_index :companies, :code, unique: true

    # Add abbreviation to assets (e.g., NEV for Neville Street)
    add_column :assets, :abbreviation, :string
    add_index :assets, :abbreviation
  end
end
