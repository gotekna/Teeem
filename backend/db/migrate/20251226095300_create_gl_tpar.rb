# frozen_string_literal: true

class CreateGlTpar < ActiveRecord::Migration[7.1]
  def change
    # TPAR (Taxable Payments Annual Report) records
    create_table :gl_tpar_reports do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :financial_year, null: false, limit: 10  # e.g., "2024-25"
      t.date :period_start, null: false
      t.date :period_end, null: false

      t.string :status, default: "draft", limit: 20
      # draft, review, lodged, amended

      t.integer :payee_count, default: 0
      t.decimal :total_gross, precision: 15, scale: 2, default: 0
      t.decimal :total_gst, precision: 15, scale: 2, default: 0
      t.decimal :total_tax_withheld, precision: 15, scale: 2, default: 0

      # Lodgement
      t.datetime :lodged_at
      t.string :lodgement_reference
      t.text :lodgement_response

      t.timestamps
    end

    add_index :gl_tpar_reports, [:corporate_id, :financial_year],
              unique: true, name: "idx_tpar_reports_year"

    # TPAR payee records
    create_table :gl_tpar_payees do |t|
      t.references :tpar_report, null: false, foreign_key: { to_table: :gl_tpar_reports }
      t.references :contact, null: false, foreign_key: true

      # Payee details
      t.string :abn, limit: 11
      t.string :payee_name
      t.string :address_line1
      t.string :address_line2
      t.string :suburb
      t.string :state, limit: 3
      t.string :postcode, limit: 4

      # Payment totals
      t.decimal :gross_paid, precision: 15, scale: 2, default: 0
      t.decimal :gst_paid, precision: 15, scale: 2, default: 0
      t.decimal :tax_withheld, precision: 15, scale: 2, default: 0

      # Flags
      t.boolean :no_abn_quoted, default: false
      t.boolean :abn_withheld, default: false

      t.timestamps
    end

    add_index :gl_tpar_payees, [:tpar_report_id, :contact_id],
              unique: true, name: "idx_tpar_payees_contact"

    # Add TPAR-required fields to contacts
    unless column_exists?(:contacts, :tpar_required)
      add_column :contacts, :tpar_required, :boolean, default: false
      add_column :contacts, :tpar_industry_code, :string, limit: 10
    end
  end
end
