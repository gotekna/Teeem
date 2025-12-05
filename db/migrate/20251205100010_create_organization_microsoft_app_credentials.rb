class CreateOrganizationMicrosoftAppCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :organization_microsoft_app_credentials do |t|
      # App registration details (from Azure AD)
      t.string :client_id, null: false
      t.text :client_secret  # Encrypted
      t.string :tenant_id, null: false

      # Token storage (Client Credentials tokens - no refresh token needed)
      t.text :access_token  # Encrypted
      t.datetime :token_expires_at

      # Status tracking
      t.boolean :is_active, default: true
      t.string :status, default: 'pending'  # pending, connected, error
      t.text :last_error

      # Admin consent tracking
      t.datetime :admin_consent_granted_at
      t.string :admin_consent_granted_by  # Email of admin who consented

      # Sync configuration
      t.jsonb :sync_config, default: {}  # Which users to sync, folders, etc.
      t.datetime :last_sync_at

      # Audit
      t.references :setup_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    # Only one active app credential per org (singleton)
    add_index :organization_microsoft_app_credentials, :is_active, unique: true, where: "is_active = true"
    add_index :organization_microsoft_app_credentials, :tenant_id
  end
end
