class CreateImapCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :imap_credentials do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name                              # "Work Email", "Personal"
      t.string :email_address, null: false

      # IMAP Settings
      t.string :imap_host, null: false            # imap.gmail.com, mail.webcentral.com.au
      t.integer :imap_port, default: 993
      t.boolean :imap_ssl, default: true

      # SMTP Settings
      t.string :smtp_host, null: false            # smtp.gmail.com
      t.integer :smtp_port, default: 587
      t.string :smtp_auth, default: 'plain'       # plain, login, cram_md5

      # Credentials (encrypted at model level)
      t.string :username, null: false
      t.text :encrypted_password

      # Provider preset (for UI convenience)
      t.string :provider                          # gmail, outlook, webcentral, custom

      # Sync state
      t.datetime :last_synced_at
      t.string :last_sync_status                  # success, error
      t.text :last_sync_error
      t.integer :sync_interval_minutes, default: 15
      t.bigint :last_uid                          # IMAP UID for incremental sync

      t.boolean :is_active, default: true
      t.timestamps

      t.index [:user_id, :email_address], unique: true
      t.index :is_active
    end
  end
end
