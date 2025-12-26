# frozen_string_literal: true

class CreateGlQuotes < ActiveRecord::Migration[7.1]
  def change
    # Sales quotes (customer-facing)
    create_table :gl_quotes do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true  # Customer
      t.references :job, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :invoice, foreign_key: { to_table: :gl_invoices }

      t.string :quote_number, null: false
      t.date :quote_date, null: false
      t.date :expiry_date
      t.string :reference

      # Status
      t.string :status, default: "draft", limit: 20
      # draft, sent, viewed, accepted, rejected, expired, converted

      # Amounts
      t.decimal :subtotal, precision: 15, scale: 2, default: 0
      t.decimal :tax, precision: 15, scale: 2, default: 0
      t.decimal :total, precision: 15, scale: 2, default: 0
      t.decimal :discount, precision: 15, scale: 2, default: 0
      t.string :discount_type, limit: 10  # percent, amount

      # Terms
      t.text :terms
      t.text :notes
      t.text :internal_notes

      # Tracking
      t.datetime :sent_at
      t.datetime :viewed_at
      t.datetime :accepted_at
      t.datetime :rejected_at
      t.datetime :converted_at
      t.string :rejection_reason

      # Customer response
      t.string :customer_signature
      t.datetime :signature_date
      t.string :signature_ip

      t.timestamps
    end

    add_index :gl_quotes, [:corporate_company_id, :quote_number],
              unique: true, name: "idx_quotes_number"
    add_index :gl_quotes, [:corporate_company_id, :status],
              name: "idx_quotes_status"
    add_index :gl_quotes, [:corporate_company_id, :contact_id],
              name: "idx_quotes_contact"

    # Quote line items
    create_table :gl_quote_lines do |t|
      t.references :quote, null: false, foreign_key: { to_table: :gl_quotes }
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }

      t.integer :sort_order, default: 0
      t.string :line_type, default: "item", limit: 20  # item, service, subtotal, discount

      t.string :code
      t.string :description, null: false
      t.decimal :quantity, precision: 15, scale: 4, default: 1
      t.string :unit_of_measure, limit: 20
      t.decimal :unit_price, precision: 15, scale: 4, null: false
      t.decimal :discount_percent, precision: 5, scale: 2
      t.decimal :tax_rate, precision: 5, scale: 2
      t.decimal :amount, precision: 15, scale: 2, null: false

      t.boolean :optional, default: false  # Optional line items
      t.boolean :selected, default: true   # Customer can select/deselect optional items

      t.timestamps
    end

    add_index :gl_quote_lines, [:quote_id, :sort_order], name: "idx_quote_lines_sort"

    # Quote versions (for tracking revisions)
    create_table :gl_quote_versions do |t|
      t.references :quote, null: false, foreign_key: { to_table: :gl_quotes }
      t.references :created_by, foreign_key: { to_table: :users }

      t.integer :version_number, null: false
      t.decimal :total, precision: 15, scale: 2
      t.text :changes_summary
      t.json :snapshot  # Full quote data at this version

      t.timestamps
    end

    add_index :gl_quote_versions, [:quote_id, :version_number],
              unique: true, name: "idx_quote_versions_unique"
  end
end
