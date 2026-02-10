class ChangeImapCredentialSyncIntervalDefault < ActiveRecord::Migration[8.0]
  def up
    change_column_default :imap_credentials, :sync_interval_minutes, from: 15, to: 2
    # Update any existing credentials still at the old 15min default
    execute "UPDATE imap_credentials SET sync_interval_minutes = 2 WHERE sync_interval_minutes = 15"
  end

  def down
    change_column_default :imap_credentials, :sync_interval_minutes, from: 2, to: 15
  end
end
