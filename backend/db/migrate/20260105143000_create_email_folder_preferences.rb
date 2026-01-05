class CreateEmailFolderPreferences < ActiveRecord::Migration[7.1]
  def change
    create_table :email_folder_preferences do |t|
      t.references :user, null: false, foreign_key: true
      t.string :account_id, null: false  # Email account ID (IMAP credential or MS365 account)
      t.string :folder_id, null: false   # Folder ID within the account
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    # Ensure unique folder per user+account
    add_index :email_folder_preferences, [:user_id, :account_id, :folder_id], unique: true, name: 'idx_email_folder_prefs_unique'
    # Fast lookup by user+account for ordering
    add_index :email_folder_preferences, [:user_id, :account_id, :position], name: 'idx_email_folder_prefs_order'
  end
end
