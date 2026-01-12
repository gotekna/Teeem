# frozen_string_literal: true

class CreateEmailSubscriptions < ActiveRecord::Migration[8.0]
  def change
    create_table :email_subscriptions do |t|
      t.references :contact, null: false, foreign_key: true
      t.references :organization, null: false, foreign_key: true
      t.string :polaris_account_id
      t.string :domain, null: false
      t.string :status, default: "pending", null: false
      t.string :billing_interval, default: "monthly", null: false
      t.decimal :retail_price, precision: 10, scale: 2
      t.decimal :wholesale_cost, precision: 10, scale: 2
      t.string :stripe_subscription_id
      t.string :stripe_customer_id
      t.string :stripe_payment_method_id
      t.date :next_billing_date
      t.date :current_period_start
      t.date :current_period_end
      t.integer :mailbox_count, default: 0
      t.integer :total_storage_gb, default: 0
      t.jsonb :metadata, default: {}
      t.datetime :started_at
      t.datetime :cancelled_at
      t.string :cancellation_reason

      t.timestamps
    end

    add_index :email_subscriptions, :domain
    add_index :email_subscriptions, :status
    add_index :email_subscriptions, :stripe_subscription_id, unique: true
    add_index :email_subscriptions, [:contact_id, :organization_id], unique: true
  end
end
