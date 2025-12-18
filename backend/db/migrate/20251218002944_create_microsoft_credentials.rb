# frozen_string_literal: true

class CreateMicrosoftCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :microsoft_credentials do |t|
      # Polymorphic ownership (optional for org-level credentials)
      t.references :owner, polymorphic: true, null: true

      # Credential type and identification
      t.string :credential_type, null: false  # 'app' or 'delegated'
      t.string :name  # for multi-org support (SSoT for org identification)

      # App credentials (for credential_type = 'app')
      t.string :client_id
      t.text :client_secret  # encrypted
      t.string :tenant_id

      # OAuth tokens (for all types)
      t.text :access_token   # encrypted
      t.text :refresh_token  # encrypted
      t.datetime :token_expires_at
      t.text :scopes
      t.string :email

      # Status tracking
      t.string :status, default: "pending", null: false
      t.string :error_code
      t.text :error_message
      t.datetime :last_error_at

      # Dead token detection (from UserMicrosoftToken)
      t.boolean :refresh_token_dead, default: false, null: false
      t.integer :consecutive_failures, default: 0, null: false
      t.datetime :last_refresh_attempt_at

      # Admin consent tracking (for app credentials)
      t.datetime :admin_consent_granted_at
      t.string :admin_consent_granted_by

      # SharePoint configuration (SSoT - previously split across models)
      t.string :sharepoint_site_id
      t.string :sharepoint_drive_id
      t.string :sharepoint_drive_name

      # OneDrive/drive configuration
      t.string :drive_id
      t.string :drive_name
      t.string :root_folder_id
      t.string :root_folder_path

      # Sync configuration and metadata
      t.jsonb :sync_config, default: {}
      t.jsonb :metadata, default: {}
      t.jsonb :bulk_sync_progress, default: {}
      t.datetime :last_sync_at

      # Audit fields
      t.references :setup_by, foreign_key: { to_table: :users }, null: true
      t.references :connected_by, foreign_key: { to_table: :users }, null: true
      t.boolean :is_active, default: true, null: false

      t.timestamps
    end

    # Indexes for efficient queries
    add_index :microsoft_credentials, [ :owner_type, :owner_id, :credential_type ],
              name: "idx_ms_creds_owner_type"
    add_index :microsoft_credentials, [ :owner_type, :owner_id, :is_active ],
              name: "idx_ms_creds_owner_active"
    add_index :microsoft_credentials, [ :credential_type, :is_active ],
              name: "idx_ms_creds_type_active"
    add_index :microsoft_credentials, :status,
              name: "idx_ms_creds_status"
    add_index :microsoft_credentials, :token_expires_at,
              name: "idx_ms_creds_token_expires"
    add_index :microsoft_credentials, [ :name, :is_active ],
              unique: true,
              where: "is_active = true AND name IS NOT NULL",
              name: "idx_ms_creds_name_unique_active"
    add_index :microsoft_credentials, :refresh_token_dead,
              name: "idx_ms_creds_dead"
  end
end
