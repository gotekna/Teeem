# frozen_string_literal: true

class CreatePaymentLinksAndPayments < ActiveRecord::Migration[8.0]
  def change
    # Payment Links - Secure tokens for invoice payment pages
    # Clients receive a unique link to pay their invoices
    create_table :payment_links do |t|
      t.references :invoice, null: false, foreign_key: { to_table: :external_invoices }
      t.references :contact, null: false, foreign_key: true
      t.string :token, null: false, index: { unique: true }
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.string :currency, default: "AUD", null: false
      t.string :status, default: "active", null: false # active, expired, paid, cancelled
      t.datetime :expires_at
      t.datetime :paid_at
      t.string :stripe_payment_intent_id
      t.string :stripe_checkout_session_id
      t.jsonb :metadata, default: {}
      t.integer :view_count, default: 0
      t.datetime :last_viewed_at
      t.string :created_by_type # User, System
      t.bigint :created_by_id

      t.timestamps
    end

    add_index :payment_links, :status
    add_index :payment_links, :expires_at
    add_index :payment_links, [:created_by_type, :created_by_id]

    # Stripe Payments - Record of all Stripe payment attempts and completions
    # Named stripe_payments to avoid conflict with existing payments table (PO payments)
    create_table :stripe_payments do |t|
      t.references :payment_link, foreign_key: true
      t.references :invoice, null: false, foreign_key: { to_table: :external_invoices }
      t.references :contact, null: false, foreign_key: true
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.decimal :stripe_fee, precision: 15, scale: 2 # Stripe processing fee
      t.decimal :net_amount, precision: 15, scale: 2 # Amount after fees
      t.string :currency, default: "AUD", null: false
      t.string :status, null: false # pending, processing, succeeded, failed, refunded
      t.string :payment_method # card, bank_transfer, etc.
      t.string :card_brand # visa, mastercard, amex
      t.string :card_last4
      t.string :stripe_payment_intent_id
      t.string :stripe_charge_id
      t.string :stripe_receipt_url
      t.string :failure_reason
      t.datetime :paid_at
      t.datetime :refunded_at
      t.decimal :refunded_amount, precision: 15, scale: 2
      t.jsonb :stripe_metadata, default: {} # Full Stripe response
      t.jsonb :metadata, default: {} # Custom metadata
      t.string :ip_address
      t.string :user_agent

      t.timestamps
    end

    add_index :stripe_payments, :status
    add_index :stripe_payments, :stripe_payment_intent_id
    add_index :stripe_payments, :stripe_charge_id
    add_index :stripe_payments, :paid_at

    # Stripe Configuration - Organization-level Stripe settings
    create_table :stripe_configurations do |t|
      t.references :organization, foreign_key: true
      t.boolean :enabled, default: false, null: false
      t.string :stripe_account_id # For Stripe Connect (optional)
      t.string :webhook_endpoint_id
      t.string :webhook_secret_encrypted
      t.decimal :surcharge_percentage, precision: 5, scale: 2, default: 0 # Pass fee to customer
      t.decimal :minimum_payment, precision: 15, scale: 2, default: 0
      t.jsonb :payment_methods_enabled, default: { "card" => true, "bank_transfer" => false }
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :stripe_configurations, :stripe_account_id, unique: true, where: "stripe_account_id IS NOT NULL"

    # Add payment tracking to external invoices
    add_column :external_invoices, :payment_link_token, :string
    add_column :external_invoices, :payment_portal_enabled, :boolean, default: true
    add_column :external_invoices, :last_payment_reminder_at, :datetime
    add_column :external_invoices, :payment_reminder_count, :integer, default: 0

    add_index :external_invoices, :payment_link_token, unique: true, where: "payment_link_token IS NOT NULL"
  end
end
