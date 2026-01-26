# frozen_string_literal: true

class CreateCloudflareCredentials < ActiveRecord::Migration[7.1]
  def change
    create_table :cloudflare_credentials do |t|
      t.references :organization, null: false, foreign_key: true

      # API credentials (encrypted)
      t.string :api_token, null: false  # Scoped API token
      t.string :account_id, null: false # Cloudflare account ID
      t.string :email                   # Optional: account email for reference

      # Connection status
      t.integer :status, default: 0, null: false  # pending: 0, connected: 1, error: 2
      t.boolean :is_active, default: true, null: false
      t.datetime :last_connected_at
      t.datetime :last_error_at
      t.string :error_message
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :cloudflare_credentials, [:organization_id, :is_active],
              name: 'idx_cloudflare_creds_org_active'
  end
end
