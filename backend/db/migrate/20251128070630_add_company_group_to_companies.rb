class AddCompanyGroupToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_reference :companies, :company_group, foreign_key: true
    add_column :companies, :abbreviation, :string  # Short code like "TPQ"

    add_index :companies, :abbreviation
  end
end
