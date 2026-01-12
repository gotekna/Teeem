class CreateDesktopClients < ActiveRecord::Migration[8.0]
  def change
    create_table :desktop_clients do |t|
      t.references :user, null: false, foreign_key: true
      t.references :organization, null: false, foreign_key: true

      t.string :device_id, null: false
      t.string :device_name, null: false
      t.string :platform  # 'macos', 'windows'
      t.string :app_version

      # Authentication
      t.text :refresh_token  # Encrypted
      t.datetime :token_expires_at
      t.string :device_code  # For device code auth flow
      t.datetime :device_code_expires_at

      # Status tracking
      t.boolean :is_active, default: true
      t.datetime :last_seen_at
      t.datetime :last_sync_at
      t.string :last_sync_status  # 'success', 'partial', 'failed'

      # Settings
      t.jsonb :sync_settings, default: {}  # bandwidth limits, etc.

      t.timestamps
    end

    add_index :desktop_clients, [:user_id, :device_id], unique: true
    add_index :desktop_clients, :device_code, unique: true
    add_index :desktop_clients, :is_active
  end
end
