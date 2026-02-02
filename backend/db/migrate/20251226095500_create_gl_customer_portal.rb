# frozen_string_literal: true

class CreateGlCustomerPortal < ActiveRecord::Migration[7.1]
  def change
    # Customer portal access tokens
    create_table :gl_portal_tokens do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true

      t.string :token, null: false
      t.string :token_type, default: "invoice", limit: 20
      # invoice (single), statement, portal (full access)

      t.bigint :invoice_id  # For single invoice tokens
      t.datetime :expires_at
      t.datetime :last_accessed_at
      t.integer :access_count, default: 0

      t.boolean :active, default: true

      t.timestamps
    end

    add_index :gl_portal_tokens, :token, unique: true, name: "idx_portal_tokens_token"
    add_index :gl_portal_tokens, [:contact_id, :token_type], name: "idx_portal_tokens_contact"

    # Customer portal sessions
    create_table :gl_portal_sessions do |t|
      t.references :portal_token, null: false, foreign_key: { to_table: :gl_portal_tokens }
      t.references :contact, null: false, foreign_key: true

      t.string :session_token, null: false
      t.string :ip_address
      t.string :user_agent
      t.datetime :expires_at
      t.datetime :last_activity_at

      t.timestamps
    end

    add_index :gl_portal_sessions, :session_token, unique: true

    # Customer statements
    create_table :gl_customer_statements do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :generated_by, foreign_key: { to_table: :users }

      t.string :reference, null: false
      t.date :statement_date, null: false
      t.date :period_start
      t.date :period_end

      # Balances
      t.decimal :opening_balance, precision: 15, scale: 2, default: 0
      t.decimal :total_invoices, precision: 15, scale: 2, default: 0
      t.decimal :total_payments, precision: 15, scale: 2, default: 0
      t.decimal :total_credits, precision: 15, scale: 2, default: 0
      t.decimal :closing_balance, precision: 15, scale: 2, default: 0

      # Aging
      t.decimal :current_amount, precision: 15, scale: 2, default: 0
      t.decimal :days_30, precision: 15, scale: 2, default: 0
      t.decimal :days_60, precision: 15, scale: 2, default: 0
      t.decimal :days_90, precision: 15, scale: 2, default: 0
      t.decimal :days_90_plus, precision: 15, scale: 2, default: 0

      t.string :status, default: "generated", limit: 20
      # generated, sent, viewed

      t.datetime :sent_at
      t.datetime :viewed_at
      t.text :notes

      t.timestamps
    end

    add_index :gl_customer_statements, [:corporate_id, :contact_id, :statement_date],
              name: "idx_statements_contact_date"

    # Statement line items
    create_table :gl_customer_statement_lines do |t|
      t.references :statement, null: false, foreign_key: { to_table: :gl_customer_statements }
      t.references :invoice, foreign_key: { to_table: :gl_invoices }
      t.references :payment, foreign_key: { to_table: :gl_payments }

      t.date :transaction_date, null: false
      t.string :transaction_type, limit: 20  # invoice, payment, credit, adjustment
      t.string :reference
      t.string :description

      t.decimal :amount, precision: 15, scale: 2
      t.decimal :running_balance, precision: 15, scale: 2

      t.timestamps
    end

    # Direct debit mandates
    create_table :gl_direct_debit_mandates do |t|
      t.references :corporate, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true

      t.string :mandate_reference, null: false
      t.string :status, default: "pending", limit: 20
      # pending, active, cancelled, expired

      # Bank details (encrypted via application-level encryption)
      t.string :bsb, limit: 7
      t.string :account_number, limit: 15
      t.string :account_name, limit: 100

      # Authorization
      t.datetime :authorized_at
      t.string :authorization_method  # online, paper, verbal
      t.string :ip_address
      t.text :signature

      # Terms
      t.date :start_date
      t.date :end_date
      t.decimal :max_amount, precision: 15, scale: 2  # Optional limit
      t.string :frequency  # one_time, weekly, monthly, per_invoice

      t.datetime :cancelled_at
      t.string :cancellation_reason

      t.timestamps
    end

    add_index :gl_direct_debit_mandates, [:corporate_id, :mandate_reference],
              unique: true, name: "idx_dd_mandates_ref"
    add_index :gl_direct_debit_mandates, [:contact_id, :status],
              name: "idx_dd_mandates_contact"

    # Add payment portal URL to invoices
    unless column_exists?(:gl_invoices, :payment_url)
      add_column :gl_invoices, :payment_url, :string
      add_column :gl_invoices, :payment_token, :string
      add_column :gl_invoices, :payment_token_expires_at, :datetime
    end
  end
end
