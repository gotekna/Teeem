class AddFinancialYearsToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    # Array of integers to support documents that span multiple financial years
    # e.g., a bank statement from June-July 2021 would have [2021, 2022]
    # Australian financial year ends June 30, so FY2021 = July 1 2020 - June 30 2021
    add_column :company_documents, :financial_years, :integer, array: true, default: []
    add_index :company_documents, :financial_years, using: :gin
  end
end
