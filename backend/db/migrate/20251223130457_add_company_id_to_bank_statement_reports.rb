class AddCompanyIdToBankStatementReports < ActiveRecord::Migration[8.0]
  def change
    add_column :bank_statement_reports, :company_id, :bigint
    add_index :bank_statement_reports, :company_id
  end
end
