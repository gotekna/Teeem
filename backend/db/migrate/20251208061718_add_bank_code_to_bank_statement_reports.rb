class AddBankCodeToBankStatementReports < ActiveRecord::Migration[8.0]
  def change
    # Bank code for filtering (e.g., NAB, WBC, BOQ, CBA, ANZ)
    add_column :bank_statement_reports, :bank_code, :string

    # Account number for display in filenames (e.g., "702 733" or "4534")
    add_column :bank_statement_reports, :account_number, :string

    # Company code for naming (e.g., "TH" for Tekna Homes)
    add_column :bank_statement_reports, :company_code, :string

    add_index :bank_statement_reports, :bank_code
    add_index :bank_statement_reports, :company_code
  end
end
