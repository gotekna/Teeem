class CreateCompanyLoans < ActiveRecord::Migration[8.0]
  def change
    create_table :company_loans do |t|
      t.references :lender_company, null: false, foreign_key: { to_table: :companies }
      t.references :borrower_company, null: false, foreign_key: { to_table: :companies }
      t.decimal :principal_amount, precision: 12, scale: 2, null: false
      t.decimal :current_balance, precision: 12, scale: 2
      t.decimal :interest_rate, precision: 5, scale: 2  # e.g., 5.50%
      t.string :interest_type  # fixed, variable, interest-free
      t.date :loan_date
      t.date :maturity_date
      t.boolean :loan_documents_in_place, default: false
      t.string :security_type  # unsecured, mortgage, ppsr
      t.string :status, default: 'active'  # active, repaid, written_off
      t.text :notes

      t.timestamps
    end
    add_index :company_loans, :status
    add_index :company_loans, :loan_date
    add_index :company_loans, :loan_documents_in_place
  end
end
