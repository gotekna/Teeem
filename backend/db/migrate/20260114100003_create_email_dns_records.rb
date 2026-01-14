# frozen_string_literal: true

class CreateEmailDnsRecords < ActiveRecord::Migration[7.1]
  def change
    create_table :email_dns_records do |t|
      t.references :email_subscription, null: false, foreign_key: true

      # DNS record details
      t.string :record_type, null: false   # mx, txt, cname
      t.string :name, null: false          # @ (root), dkim._domainkey, autodiscover, etc.
      t.text :content, null: false         # Record value
      t.integer :priority                  # For MX records
      t.boolean :proxied, default: false   # Cloudflare proxy status

      # Cloudflare tracking
      t.string :cloudflare_record_id       # Cloudflare's record ID for updates/deletes
      t.string :cloudflare_zone_id         # Zone this record belongs to

      # Status tracking
      t.integer :status, default: 0, null: false  # pending, created, verified, error, missing
      t.string :error_message
      t.datetime :last_verified_at
      t.datetime :provisioned_at

      t.timestamps
    end

    add_index :email_dns_records, [:email_subscription_id, :record_type, :name],
              name: 'idx_email_dns_sub_type_name',
              unique: true
    add_index :email_dns_records, :cloudflare_record_id
    add_index :email_dns_records, :status

    # Add dns_status to email_subscriptions for quick lookups
    add_column :email_subscriptions, :dns_status, :string, default: 'pending'
    add_index :email_subscriptions, :dns_status
  end
end
