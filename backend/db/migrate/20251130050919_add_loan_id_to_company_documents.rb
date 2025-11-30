class AddLoanIdToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_reference :company_documents, :loan, null: true, foreign_key: { to_table: :company_loans }, index: true
  end
end
