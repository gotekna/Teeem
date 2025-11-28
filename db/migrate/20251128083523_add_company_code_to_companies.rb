class AddCompanyCodeToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :company_code, :string
  end
end
