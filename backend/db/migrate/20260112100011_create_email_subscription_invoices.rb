# frozen_string_literal: true

class CreateEmailSubscriptionInvoices < ActiveRecord::Migration[8.0]
  def change
    create_table :email_subscription_invoices do |t|
      t.references :email_subscription, null: false, foreign_key: true
      t.references :gl_invoice, foreign_key: { to_table: :gl_invoices }
      t.date :billing_period_start, null: false
      t.date :billing_period_end, null: false
      t.decimal :retail_amount, precision: 10, scale: 2
      t.decimal :wholesale_amount, precision: 10, scale: 2
      t.string :stripe_invoice_id
      t.string :status, default: "pending", null: false
      t.datetime :paid_at
      t.string :failure_reason

      t.timestamps
    end

    add_index :email_subscription_invoices, :status
    add_index :email_subscription_invoices, :stripe_invoice_id
    add_index :email_subscription_invoices,
              [:billing_period_start, :billing_period_end],
              name: "idx_email_invoices_period"
  end
end
