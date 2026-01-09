# frozen_string_literal: true

class CreateProfitLossReports < ActiveRecord::Migration[8.0]
  def change
    create_table :profit_loss_reports do |t|
      # Company reference
      t.references :company, null: false, foreign_key: true
      t.string :company_name, null: false
      t.string :company_code

      # Report period
      t.string :financial_year, null: false
      t.date :report_date
      t.date :period_start
      t.date :period_end

      # Financial data from Xero
      t.decimal :total_revenue, precision: 15, scale: 2, default: 0
      t.decimal :total_expenses, precision: 15, scale: 2, default: 0
      t.decimal :net_profit, precision: 15, scale: 2, default: 0

      # Raw report data from Xero (JSON)
      t.jsonb :report_data

      # File storage (SharePoint)
      t.string :cloudinary_public_id
      t.string :cloudinary_url
      t.string :file_name
      t.integer :file_size

      # Status tracking
      t.string :status, default: "pending"
      t.datetime :generated_at
      t.text :error_message

      t.timestamps
    end

    add_index :profit_loss_reports, [ :company_id, :financial_year ], unique: true, name: "idx_pl_reports_unique"
    add_index :profit_loss_reports, :financial_year
    add_index :profit_loss_reports, :status
    add_index :profit_loss_reports, :company_code
  end
end
