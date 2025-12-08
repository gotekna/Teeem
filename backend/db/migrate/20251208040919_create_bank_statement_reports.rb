class CreateBankStatementReports < ActiveRecord::Migration[8.0]
  def change
    create_table :bank_statement_reports do |t|
      t.timestamps
    end
  end
end
