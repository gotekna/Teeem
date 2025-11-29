class AddLoanFieldsToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_column :companies, :has_loans, :boolean, default: false
    add_column :companies, :loan_documents_in_place, :boolean, default: false
  end
end
