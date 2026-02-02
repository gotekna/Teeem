# frozen_string_literal: true

class CreateGlProviderCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_provider_credentials do |t|
      t.references :corporate, null: false, foreign_key: true

      # Provider Identity
      t.string :provider, null: false     # 'xero', 'quickbooks', 'myob'
      t.string :tenant_id, null: false    # Provider's org/company ID
      t.string :tenant_name               # "TEEEM Pty Ltd"

      # OAuth tokens (encrypted via attr_encrypted or Rails credentials)
      t.text :access_token_encrypted
      t.text :refresh_token_encrypted
      t.datetime :token_expires_at

      # Connection status
      t.string :status, default: 'pending'  # pending, connected, expired, error, disconnected
      t.string :error_message
      t.datetime :connected_at
      t.datetime :disconnected_at

      # Sync tracking
      t.datetime :last_sync_at
      t.datetime :last_full_sync_at
      t.string :last_sync_status          # success, partial, failed

      # Configuration
      t.boolean :sync_enabled, default: true
      t.boolean :two_way_sync, default: false  # Push changes back to provider
      t.jsonb :sync_settings, default: {}      # Custom sync preferences

      t.timestamps
    end

    # Unique constraint: one credential per provider per tenant per company
    add_index :gl_provider_credentials, [:corporate_id, :provider, :tenant_id],
              unique: true, name: 'idx_gl_provider_credentials_unique'

    # Performance indexes
    add_index :gl_provider_credentials, :status
    add_index :gl_provider_credentials, :provider
    add_index :gl_provider_credentials, :sync_enabled
  end
end
