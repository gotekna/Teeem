class CreateBankStatementReports < ActiveRecord::Migration[8.0]
  def change
    create_table :bank_statement_reports do |t|
      # Bank account identification
      t.string :bank_account_id, null: false
      t.string :bank_account_name, null: false

      # Period identification
      t.string :financial_year, null: false  # e.g., "FY2024"
      t.integer :month                        # 1-12, nil for full FY report
      t.integer :year                         # Calendar year for the month

      # Report metadata
      t.string :report_type, default: "monthly"  # "monthly" or "annual"
      t.date :period_start
      t.date :period_end
      t.integer :transaction_count, default: 0
      t.decimal :total_in, precision: 15, scale: 2, default: 0
      t.decimal :total_out, precision: 15, scale: 2, default: 0
      t.decimal :net_change, precision: 15, scale: 2, default: 0

      # PDF storage (Cloudinary)
      t.string :cloudinary_public_id
      t.string :cloudinary_url
      t.string :file_name
      t.integer :file_size

      # Generation tracking
      t.datetime :generated_at
      t.string :status, default: "pending"  # pending, generating, completed, failed
      t.text :error_message

      t.timestamps
    end

    add_index :bank_statement_reports, [ :bank_account_id, :financial_year, :month ], unique: true, name: "idx_bank_reports_unique"
    add_index :bank_statement_reports, :financial_year
    add_index :bank_statement_reports, :status
  end
end
